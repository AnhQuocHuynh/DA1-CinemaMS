using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.Features.Rooms.Queries;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using Moq;
using Xunit;

namespace FacilityService.Test.ApplicationTests.Features.Rooms
{
    public class GetRoomsByCinemaQueryHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly GetRoomsByCinemaQueryHandler _handler;

        public GetRoomsByCinemaQueryHandlerTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _handler = new GetRoomsByCinemaQueryHandler(_mockUnitOfWork.Object);
        }

        [Fact]
        public async Task Handle_ReturnsOnlyActiveRooms()
        {
            // Arrange
            var cinema = new Cinema("Test", "Addr", null, null);
            var activeRoom = new Room(cinema, "Active Room", null, null, null, null);
            var inactiveRoom = new Room(cinema, "Inactive Room", null, null, null, null);
            inactiveRoom.Disable();

            _mockUnitOfWork.Setup(u => u.Rooms.GetRoomsByCinemaIdAsync(1))
                .ReturnsAsync(new List<Room> { activeRoom, inactiveRoom });

            var query = new GetRoomsByCinemaQuery { CinemaId = 1 };

            // Act
            var result = await _handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Single(result);
            Assert.Equal("Active Room", result.First().Name);
        }
    }
}
