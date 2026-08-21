using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.Contracts;
using FacilityService.Application.Exceptions;
using FacilityService.Application.Features.Rooms.Commands;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Interfaces;
using Moq;
using Xunit;

namespace FacilityService.Test.Unit.Features.Rooms
{
    public class DeleteRoomCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly Mock<IShowtimeServiceClient> _mockShowtimeService;
        private readonly DeleteRoomCommandHandler _handler;

        public DeleteRoomCommandHandlerTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _mockShowtimeService = new Mock<IShowtimeServiceClient>();
            _handler = new DeleteRoomCommandHandler(_mockUnitOfWork.Object, _mockShowtimeService.Object, new Mock<Microsoft.Extensions.Caching.Distributed.IDistributedCache>().Object);
        }

        [Fact]
        public async Task Handle_RoomHasFutureShowtimes_ThrowsException()
        {
            // Arrange
            var cinema = new Cinema("Name", "Addr", null, null);
            var room = new Room(cinema, "Room 1", null, null, null, null);

            var command = new DeleteRoomCommand { Id = 1 };

            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(1))
                .ReturnsAsync(room);
            _mockShowtimeService.Setup(s => s.HasFutureShowtimesAsync(It.IsAny<List<long>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act & Assert
            var ex = await Assert.ThrowsAsync<BadRequestException>(() => _handler.Handle(command, CancellationToken.None));
            Assert.Contains("Cannot delete room with future showtimes scheduled", ex.Message);
            
            Assert.True(room.Active); // Should not be disabled
        }

        [Fact]
        public async Task Handle_RoomHasNoFutureShowtimes_DisablesRoom()
        {
            // Arrange
            var cinema = new Cinema("Name", "Addr", null, null);
            var room = new Room(cinema, "Room 1", null, null, null, null);

            var command = new DeleteRoomCommand { Id = 1 };

            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(1))
                .ReturnsAsync(room);
            _mockShowtimeService.Setup(s => s.HasFutureShowtimesAsync(It.IsAny<List<long>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            Assert.True(result);
            Assert.False(room.Active);
            _mockUnitOfWork.Verify(u => u.Rooms.Update(room), Times.Once);
            _mockUnitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}

