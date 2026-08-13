using System;
using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.Exceptions;
using FacilityService.Application.Features.Cinemas.Commands;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using Moq;
using Xunit;

namespace FacilityService.Test.Unit.Features.Cinemas
{
    public class UpdateCinemaCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly UpdateCinemaCommandHandler _handler;

        public UpdateCinemaCommandHandlerTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _handler = new UpdateCinemaCommandHandler(_mockUnitOfWork.Object);
        }

        [Fact]
        public async Task Handle_ExistingCinema_UpdatesAndReturnsDto()
        {
            // Arrange
            var cinema = new Cinema("Old Name", "Old Address", null, null);
            var command = new UpdateCinemaCommand
            {
                Id = 1,
                Name = "New Name",
                Address = "New Address",
                City = "New City",
                Phone = "New Phone"
            };

            _mockUnitOfWork.Setup(u => u.Cinemas.GetByIdAsync(command.Id))
                .ReturnsAsync(cinema);
            _mockUnitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(1);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            Assert.NotNull(result);
            Assert.Equal(command.Name, result.Name);
            Assert.Equal(command.Address, result.Address);
            
            // Check domain entity was mutated
            Assert.Equal(command.Name, cinema.Name);
            Assert.Equal(command.Address, cinema.Address);

            _mockUnitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_NonExistingCinema_ThrowsException()
        {
            // Arrange
            var command = new UpdateCinemaCommand { Id = 1, Name = "A", Address = "B" };

            _mockUnitOfWork.Setup(u => u.Cinemas.GetByIdAsync(command.Id))
                .ReturnsAsync((Cinema?)null);

            // Act & Assert
            var ex = await Assert.ThrowsAsync<CinemaNotFoundException>(() => _handler.Handle(command, CancellationToken.None));
            Assert.Contains($"Cinema with id {command.Id} was not found", ex.Message);
        }
    }
}
