using System;
using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.Exceptions;
using FacilityService.Application.Features.Rooms.Commands;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Enum;
using FacilityService.Domain.Interfaces;
using Moq;
using Xunit;

namespace FacilityService.Test.Unit.Features.Rooms
{
    public class CreateRoomCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly CreateRoomCommandHandler _handler;

        public CreateRoomCommandHandlerTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _handler = new CreateRoomCommandHandler(_mockUnitOfWork.Object);
        }

        [Fact]
        public async Task Handle_ValidRequest_CreatesRoomAndGeneratesSeats()
        {
            // Arrange
            var cinema = new Cinema("Name", "Addr", null, null);
            var command = new CreateRoomCommand
            {
                CinemaId = 1,
                Name = "Room 1",
                Rows = 10,
                Columns = 10
            };

            _mockUnitOfWork.Setup(u => u.Cinemas.GetByIdAsync(command.CinemaId))
                .ReturnsAsync(cinema);
                
            var standardSeatType = new SeatType(SeatTypeCode.STANDARD, "standard", "Standard", 1.0m, 1, "Standard");
            _mockUnitOfWork.Setup(u => u.SeatTypes.GetByCodeAsync(SeatTypeCode.STANDARD))
                .ReturnsAsync(standardSeatType);
                
            _mockUnitOfWork.Setup(u => u.Rooms.AddAsync(It.IsAny<Room>()))
                .Returns(Task.CompletedTask);
            _mockUnitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(1);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(command.Name, result.Name);
            Assert.Equal(command.Rows, result.Rows);
            Assert.Equal(command.Columns, result.Columns);
            
            // Check that AddAsync was called with a Room that has seats generated
            _mockUnitOfWork.Verify(u => u.Rooms.AddAsync(It.Is<Room>(r => r.TotalSeats == 100)), Times.Once);
            _mockUnitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_CinemaNotFound_ThrowsCinemaNotFoundException()
        {
            // Arrange
            var command = new CreateRoomCommand { CinemaId = 1, Name = "Room" };
            
            _mockUnitOfWork.Setup(u => u.Cinemas.GetByIdAsync(command.CinemaId))
                .ReturnsAsync((Cinema?)null);
                
            // Act & Assert
            await Assert.ThrowsAsync<CinemaNotFoundException>(() => _handler.Handle(command, CancellationToken.None));
        }
    }
}
