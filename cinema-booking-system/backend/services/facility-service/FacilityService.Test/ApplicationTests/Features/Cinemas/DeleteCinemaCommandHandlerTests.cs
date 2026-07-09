using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.Contracts;
using FacilityService.Application.Exceptions;
using FacilityService.Application.Features.Cinemas.Commands;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using Moq;
using Xunit;

namespace FacilityService.Test.ApplicationTests.Features.Cinemas
{
    public class DeleteCinemaCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly Mock<IShowtimeServiceClient> _mockShowtimeService;
        private readonly DeleteCinemaCommandHandler _handler;

        public DeleteCinemaCommandHandlerTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _mockShowtimeService = new Mock<IShowtimeServiceClient>();
            _handler = new DeleteCinemaCommandHandler(_mockUnitOfWork.Object, _mockShowtimeService.Object);
        }

        [Fact]
        public async Task Handle_CinemaHasFutureShowtimes_ThrowsException()
        {
            // Arrange
            var cinema = new Cinema("Name", "Addr", null, null);
            var room = new Room(cinema, "Room 1", null, null, null, null);
            cinema.Rooms.Add(room);

            var command = new DeleteCinemaCommand { Id = 1 };

            _mockUnitOfWork.Setup(u => u.Cinemas.GetByIdAsync(1))
                .ReturnsAsync(cinema);
            _mockShowtimeService.Setup(s => s.HasFutureShowtimesAsync(It.IsAny<List<long>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act & Assert
            var ex = await Assert.ThrowsAsync<BadRequestException>(() => _handler.Handle(command, CancellationToken.None));
            Assert.Contains("Cannot delete cinema with future showtimes scheduled", ex.Message);
            
            Assert.True(cinema.Active); // Should not be disabled
        }

        [Fact]
        public async Task Handle_CinemaHasNoFutureShowtimes_DisablesCinema()
        {
            // Arrange
            var cinema = new Cinema("Name", "Addr", null, null);
            var room = new Room(cinema, "Room 1", null, null, null, null);
            cinema.Rooms.Add(room);

            var command = new DeleteCinemaCommand { Id = 1 };

            _mockUnitOfWork.Setup(u => u.Cinemas.GetByIdAsync(1))
                .ReturnsAsync(cinema);
            _mockShowtimeService.Setup(s => s.HasFutureShowtimesAsync(It.IsAny<List<long>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            Assert.True(result);
            Assert.False(cinema.Active);
            _mockUnitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_CinemaHasNoActiveRooms_DisablesCinemaWithoutCheckingShowtimes()
        {
            // Arrange
            var cinema = new Cinema("Name", "Addr", null, null);
            // No rooms added

            var command = new DeleteCinemaCommand { Id = 1 };

            _mockUnitOfWork.Setup(u => u.Cinemas.GetByIdAsync(1))
                .ReturnsAsync(cinema);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            Assert.True(result);
            Assert.False(cinema.Active);
            _mockShowtimeService.Verify(s => s.HasFutureShowtimesAsync(It.IsAny<List<long>>(), It.IsAny<CancellationToken>()), Times.Never);
            _mockUnitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
