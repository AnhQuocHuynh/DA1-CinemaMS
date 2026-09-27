using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.Exceptions;
using FacilityService.Application.Features.SeatTemplates.Queries;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using Moq;
using Xunit;

namespace FacilityService.Test.Unit.Features.SeatTemplates
{
    public class GetSeatTemplatesByRoomQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly GetSeatTemplatesByRoomQueryHandler _handler;

        public GetSeatTemplatesByRoomQueryHandlerTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _handler = new GetSeatTemplatesByRoomQueryHandler(_mockUnitOfWork.Object, new Mock<Microsoft.Extensions.Caching.Distributed.IDistributedCache>().Object);
        }

        [Fact]
        public async Task Handle_ValidRequest_ReturnsActiveSeatTemplates()
        {
            // Arrange
            var cinema = new Cinema("Name", "Addr", null, null);
            var room = new Room(cinema, "Room 1", null, null, null, null);
            
            var activeSeat = new SeatTemplate(room, null, "A", 1);
            var inactiveSeat = new SeatTemplate(room, null, "A", 2);
            inactiveSeat.Disable();

            var query = new GetSeatTemplatesByRoomQuery { RoomId = 1 };

            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(query.RoomId))
                .ReturnsAsync(room);
            _mockUnitOfWork.Setup(u => u.SeatTemplates.GetByRoomIdAsync(query.RoomId))
                .ReturnsAsync(new List<SeatTemplate> { activeSeat, inactiveSeat });

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Single(result);
            Assert.Equal("A", result.First().RowLabel);
            Assert.Equal(1, result.First().ColumnNumber);
        }

        [Fact]
        public async Task Handle_RoomNotFound_ThrowsRoomNotFoundException()
        {
            // Arrange
            var query = new GetSeatTemplatesByRoomQuery { RoomId = 1 };

            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(query.RoomId))
                .ReturnsAsync((Room?)null);

            // Act & Assert
            await Assert.ThrowsAsync<RoomNotFoundException>(() => _handler.Handle(query, CancellationToken.None));
        }
    }
}

