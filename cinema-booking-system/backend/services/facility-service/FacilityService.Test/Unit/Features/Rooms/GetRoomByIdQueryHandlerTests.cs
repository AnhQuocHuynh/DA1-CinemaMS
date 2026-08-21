using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.Exceptions;
using FacilityService.Application.Features.Rooms.Queries;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using Moq;
using Xunit;

namespace FacilityService.Test.Unit.Features.Rooms
{
    public class GetRoomByIdQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly GetRoomByIdQueryHandler _handler;

        public GetRoomByIdQueryHandlerTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _handler = new GetRoomByIdQueryHandler(_mockUnitOfWork.Object, new Mock<Microsoft.Extensions.Caching.Distributed.IDistributedCache>().Object);
        }

        [Fact]
        public async Task Handle_ValidId_ReturnsRoomDto()
        {
            // Arrange
            var cinema = new Cinema("Test Name", "Test Address", "Test City", "123456789");
            var room = new Room(cinema, "Room 1", "Standard", 100, 10, 10);
            
            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(1))
                .ReturnsAsync(room);

            var query = new GetRoomByIdQuery { Id = 1 };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("Room 1", result.Name);
            Assert.Equal("Standard", result.Type);
            Assert.Equal(100, result.TotalSeats);
        }

        [Fact]
        public async Task Handle_RoomNotFound_ThrowsRoomNotFoundException()
        {
            // Arrange
            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(1))
                .ReturnsAsync((Room?)null);

            var query = new GetRoomByIdQuery { Id = 1 };

            // Act & Assert
            await Assert.ThrowsAsync<RoomNotFoundException>(() => _handler.Handle(query, CancellationToken.None));
        }
    }
}

