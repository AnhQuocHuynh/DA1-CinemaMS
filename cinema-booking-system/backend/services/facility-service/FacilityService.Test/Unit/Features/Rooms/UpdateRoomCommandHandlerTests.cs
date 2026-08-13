using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.Exceptions;
using FacilityService.Application.Features.Rooms.Commands;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using Moq;
using Xunit;

namespace FacilityService.Test.Unit.Features.Rooms
{
    public class UpdateRoomCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly UpdateRoomCommandHandler _handler;

        public UpdateRoomCommandHandlerTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _handler = new UpdateRoomCommandHandler(_mockUnitOfWork.Object);
        }

        [Fact]
        public async Task Handle_ValidRequest_UpdatesRoom()
        {
            // Arrange
            var cinema = new Cinema("Name", "Addr", null, null);
            var room = new Room(cinema, "Old Room", null, null, null, null);
            
            var command = new UpdateRoomCommand
            {
                Id = 1,
                CinemaId = cinema.Id,
                Name = "New Room",
                Rows = 10,
                Columns = 10
            };

            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(command.Id))
                .ReturnsAsync(room);
            
            // Cinema unchanged
            _mockUnitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(1);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal("New Room", result.Name);
            Assert.Equal(10, result.Rows);
            
            _mockUnitOfWork.Verify(u => u.Rooms.Update(room), Times.Once);
            _mockUnitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_RoomNotFound_ThrowsRoomNotFoundException()
        {
            // Arrange
            var command = new UpdateRoomCommand { Id = 1, CinemaId = 1, Name = "Room" };
            
            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(command.Id))
                .ReturnsAsync((Room?)null);
                
            // Act & Assert
            await Assert.ThrowsAsync<RoomNotFoundException>(() => _handler.Handle(command, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_ChangeCinemaToInvalidCinemaId_ThrowsCinemaNotFoundException()
        {
            // Arrange
            var cinema = new Cinema("Name", "Addr", null, null);
            // Simulate that room belongs to cinema id 2, but command tries to move to cinema id 1
            var room = new Room(cinema, "Old Room", null, null, null, null);
            // mock the property getter or just let the constructor set CinemaId to 0 (default).
            // Actually Cinema constructor does not set ID. We can just use reflection or assume it's 0.
            
            var command = new UpdateRoomCommand
            {
                Id = 1,
                CinemaId = 99, // Different from room.CinemaId
                Name = "New Room",
                Rows = 10,
                Columns = 10
            };

            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(command.Id))
                .ReturnsAsync(room);
            
            _mockUnitOfWork.Setup(u => u.Cinemas.GetByIdAsync(command.CinemaId))
                .ReturnsAsync((Cinema?)null); // Cannot find new cinema
                
            // Act & Assert
            await Assert.ThrowsAsync<CinemaNotFoundException>(() => _handler.Handle(command, CancellationToken.None));
        }
    }
}
