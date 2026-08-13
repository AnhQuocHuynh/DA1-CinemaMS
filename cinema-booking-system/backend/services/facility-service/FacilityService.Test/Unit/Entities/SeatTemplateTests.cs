using System;
using FacilityService.Domain.Entities;
using FacilityService.Domain.Enum;
using Xunit;

namespace FacilityService.Test.Unit.Entities
{
    public class SeatTemplateTests
    {
        [Fact]
        public void Constructor_WithValidData_CreatesSeatTemplateAndSetsDefaults()
        {
            // Arrange
            var cinema = new Cinema("Test", "Addr", null, null);
            var room = new Room(cinema, "Room 1", null, null, null, null);
            var seatType = new SeatType(SeatTypeCode.STANDARD, "Standard", null, null, null, null);

            // Act
            var template = new SeatTemplate(room, seatType, "A", 1);

            // Assert
            Assert.NotNull(template.Room);
            Assert.Equal("A", template.RowLabel);
            Assert.Equal(1, template.ColumnNumber);
            Assert.Equal(1, template.ColumnSpan);
            Assert.False(template.Pathway);
            Assert.True(template.Active);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Constructor_WithInvalidRowLabel_ThrowsArgumentException(string invalidLabel)
        {
            // Arrange
            var cinema = new Cinema("Test", "Addr", null, null);
            var room = new Room(cinema, "Room 1", null, null, null, null);

            // Act & Assert
            var ex = Assert.Throws<ArgumentException>(() => new SeatTemplate(room, null, invalidLabel, 1));
            Assert.Contains("RowLabel is required", ex.Message);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(-1)]
        public void Constructor_WithInvalidColumnNumber_ThrowsArgumentException(int invalidColumn)
        {
            // Arrange
            var cinema = new Cinema("Test", "Addr", null, null);
            var room = new Room(cinema, "Room 1", null, null, null, null);

            // Act & Assert
            var ex = Assert.Throws<ArgumentException>(() => new SeatTemplate(room, null, "A", invalidColumn));
            Assert.Contains("ColumnNumber must be greater than 0", ex.Message);
        }
    }
}
