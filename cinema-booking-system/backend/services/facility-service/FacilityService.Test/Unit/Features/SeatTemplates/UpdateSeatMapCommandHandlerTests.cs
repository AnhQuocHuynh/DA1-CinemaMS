using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.DTOs;
using FacilityService.Application.Exceptions;
using FacilityService.Application.Features.SeatTemplates.Commands;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Enum;
using FacilityService.Domain.Interfaces;
using Moq;
using Xunit;

namespace FacilityService.Test.Unit.Features.SeatTemplates
{
    public class UpdateSeatMapCommandHandlerTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly UpdateSeatMapCommandHandler _handler;

        public UpdateSeatMapCommandHandlerTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _handler = new UpdateSeatMapCommandHandler(_mockUnitOfWork.Object);
        }

        [Fact]
        public async Task Handle_ValidRequest_UpdatesSeatMap()
        {
            // Arrange
            var cinema = new Cinema("Name", "Addr", null, null);
            var room = new Room(cinema, "Room 1", null, null, null, null);
            var existingSeat = new SeatTemplate(room, null, "A", 1);
            
            var command = new UpdateSeatMapCommand
            {
                RoomId = 1,
                Request = new SeatMapUpdateRequestDto
                {
                    Rows = 2,
                    Columns = 2,
                    Seats = new List<SeatRequestDto>
                    {
                        new SeatRequestDto { RowLabel = "A", ColumnNumber = 1, SeatTypeCode = "STANDARD" }
                    }
                }
            };

            var standardType = new SeatType(SeatTypeCode.STANDARD, "standard", "Standard", 1.0m, 1, "Standard");

            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(command.RoomId))
                .ReturnsAsync(room);
            _mockUnitOfWork.Setup(u => u.SeatTemplates.GetByRoomIdAsync(room.Id))
                .ReturnsAsync(new List<SeatTemplate> { existingSeat });
            _mockUnitOfWork.Setup(u => u.SeatTypes.GetByCodeAsync(SeatTypeCode.STANDARD))
                .ReturnsAsync(standardType);

            _mockUnitOfWork.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(1);

            // Act
            var result = await _handler.Handle(command, CancellationToken.None);

            // Assert
            Assert.True(result);
            Assert.Equal(2, room.Rows);
            Assert.Equal(2, room.Columns);

            _mockUnitOfWork.Verify(u => u.SeatTemplates.RemoveRange(It.IsAny<IEnumerable<SeatTemplate>>()), Times.Once);
            _mockUnitOfWork.Verify(u => u.SeatTemplates.AddRangeAsync(It.Is<IEnumerable<SeatTemplate>>(l => ((List<SeatTemplate>)l).Count == 1)), Times.Once);
            _mockUnitOfWork.Verify(u => u.Rooms.Update(room), Times.Once);
            _mockUnitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public async Task Handle_RoomNotFound_ThrowsRoomNotFoundException()
        {
            // Arrange
            var command = new UpdateSeatMapCommand
            {
                RoomId = 1,
                Request = new SeatMapUpdateRequestDto { Rows = 1, Columns = 1, Seats = new List<SeatRequestDto>() }
            };

            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(command.RoomId))
                .ReturnsAsync((Room?)null);

            // Act & Assert
            await Assert.ThrowsAsync<RoomNotFoundException>(() => _handler.Handle(command, CancellationToken.None));
        }

        [Fact]
        public async Task Handle_InvalidSeatTypeCode_ThrowsException()
        {
            // Arrange
            var cinema = new Cinema("Name", "Addr", null, null);
            var room = new Room(cinema, "Room 1", null, null, null, null);
            
            var command = new UpdateSeatMapCommand
            {
                RoomId = 1,
                Request = new SeatMapUpdateRequestDto
                {
                    Rows = 2,
                    Columns = 2,
                    Seats = new List<SeatRequestDto>
                    {
                        new SeatRequestDto { RowLabel = "A", ColumnNumber = 1, SeatTypeCode = "INVALID_TYPE" }
                    }
                }
            };

            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(command.RoomId))
                .ReturnsAsync(room);
            _mockUnitOfWork.Setup(u => u.SeatTemplates.GetByRoomIdAsync(room.Id))
                .ReturnsAsync(new List<SeatTemplate>());

            // Act & Assert
            var ex = await Assert.ThrowsAsync<BadRequestException>(() => _handler.Handle(command, CancellationToken.None));
            Assert.Contains("Invalid seat type", ex.Message);
        }

        [Fact]
        public async Task Handle_ValidCodeButSeatTypeNotFoundInDb_ThrowsException()
        {
            // Arrange
            var cinema = new Cinema("Name", "Addr", null, null);
            var room = new Room(cinema, "Room 1", null, null, null, null);
            
            var command = new UpdateSeatMapCommand
            {
                RoomId = 1,
                Request = new SeatMapUpdateRequestDto
                {
                    Rows = 2,
                    Columns = 2,
                    Seats = new List<SeatRequestDto>
                    {
                        new SeatRequestDto { RowLabel = "A", ColumnNumber = 1, SeatTypeCode = "STANDARD" }
                    }
                }
            };

            _mockUnitOfWork.Setup(u => u.Rooms.GetByIdAsync(command.RoomId))
                .ReturnsAsync(room);
            
            _mockUnitOfWork.Setup(u => u.SeatTemplates.GetByRoomIdAsync(room.Id))
                .ReturnsAsync(new List<SeatTemplate>());
            
            _mockUnitOfWork.Setup(u => u.SeatTypes.GetByCodeAsync(SeatTypeCode.STANDARD))
                .ReturnsAsync((SeatType?)null);

            // Act & Assert
            var ex = await Assert.ThrowsAsync<SeatTypeNotFoundException>(() => _handler.Handle(command, CancellationToken.None));
            Assert.Contains("Seat type with code STANDARD was not found.", ex.Message);
        }
    }
}
