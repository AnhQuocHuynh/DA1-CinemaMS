using System;
using FacilityService.Domain.Entities;
using Xunit;

namespace FacilityService.Test.DomainTests
{
    public class RoomTests
    {
        [Fact]
        public void Constructor_WithValidData_CreatesRoomAndSetsDefaults()
        {
            // Arrange
            var cinema = new Cinema("Test Cinema", "Test Addr", null, null);
            string roomName = "Room 1";

            // Act
            var room = new Room(cinema, roomName, "Standard", 100, 10, 10);

            // Assert
            Assert.NotNull(room.Cinema);
            Assert.Equal(cinema.Id, room.CinemaId);
            Assert.Equal(roomName, room.Name);
            Assert.True(room.Active);
            Assert.False(room.UnderMaintenance);
        }

        [Fact]
        public void Constructor_WithNullCinema_ThrowsArgumentNullException()
        {
            // Act & Assert
            var ex = Assert.Throws<ArgumentNullException>(() => new Room(null!, "Room 1", "Standard", 100, 10, 10));
            Assert.Contains("cinema", ex.Message);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Constructor_WithInvalidName_ThrowsArgumentException(string invalidName)
        {
            // Arrange
            var cinema = new Cinema("Test", "Addr", null, null);

            // Act & Assert
            var ex = Assert.Throws<ArgumentException>(() => new Room(cinema, invalidName, null, null, null, null));
            Assert.Contains("Name is required", ex.Message);
        }
    }
}
