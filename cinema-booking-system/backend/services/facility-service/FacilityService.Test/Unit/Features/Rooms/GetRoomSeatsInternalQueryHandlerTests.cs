using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.Exceptions;
using FacilityService.Application.Features.Rooms.Queries;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Enum;
using FacilityService.Domain.Interfaces;
using Moq;
using Xunit;

namespace FacilityService.Test.Unit.Features.Rooms
{
    public class GetRoomSeatsInternalQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly GetRoomSeatsInternalQueryHandler _handler;

        public GetRoomSeatsInternalQueryHandlerTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _handler = new GetRoomSeatsInternalQueryHandler(_mockUnitOfWork.Object);
        }

        [Fact]
        public async Task Handle_ValidRequest_ReturnsInternalRoomSeatsDtoList()
        {
            // Arrange
            var cinema = new Cinema("Test", "Addr", null, null);
            var room = new Room(cinema, "Room", null, null, null, null);
            var standardType = new SeatType(SeatTypeCode.STANDARD, "standard", "Standard", 1.0m, 1, "Standard");

            var activeSeat = new SeatTemplate(room, standardType, "A", 1);
            var inactiveSeat = new SeatTemplate(room, standardType, "A", 2);
            inactiveSeat.Disable();

            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(1))
                .ReturnsAsync(room);
            _mockUnitOfWork.Setup(u => u.SeatTemplates.GetByRoomIdAsync(1))
                .ReturnsAsync(new List<SeatTemplate> { activeSeat, inactiveSeat });

            var query = new GetRoomSeatsInternalQuery { RoomId = 1 };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Single(result);
            Assert.Equal("A", result.First().RowLabel);
            Assert.Equal(1, result.First().ColumnNumber);
            Assert.Equal("STANDARD", result.First().SeatTypeCode);
        }

        [Fact]
        public async Task Handle_RoomNotFound_ThrowsRoomNotFoundException()
        {
            // Arrange
            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(1))
                .ReturnsAsync((Room?)null);

            var query = new GetRoomSeatsInternalQuery { RoomId = 1 };

            // Act & Assert
            await Assert.ThrowsAsync<RoomNotFoundException>(() => _handler.Handle(query, CancellationToken.None));
        }
    }
}
