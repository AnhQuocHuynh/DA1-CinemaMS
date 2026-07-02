using System;
using FacilityService.Domain.Entities;
using Xunit;

namespace FacilityService.Test.DomainTests
{
    public class CinemaTests
    {
        [Fact]
        public void Constructor_WithValidData_CreatesCinemaAndDefaultsActiveToTrue()
        {
            // Arrange
            string name = "CGV Vincom";
            string address = "123 Main St";

            // Act
            var cinema = new Cinema(name, address, null, null);

            // Assert
            Assert.Equal(name, cinema.Name);
            Assert.Equal(address, cinema.Address);
            Assert.True(cinema.Active);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Constructor_WithInvalidName_ThrowsArgumentException(string invalidName)
        {
            // Arrange
            string address = "123 Main St";

            // Act & Assert
            var ex = Assert.Throws<ArgumentException>(() => new Cinema(invalidName, address, null, null));
            Assert.Contains("Name is required", ex.Message);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Constructor_WithInvalidAddress_ThrowsArgumentException(string invalidAddress)
        {
            // Arrange
            string name = "CGV Vincom";

            // Act & Assert
            var ex = Assert.Throws<ArgumentException>(() => new Cinema(name, invalidAddress, null, null));
            Assert.Contains("Address is required", ex.Message);
        }
    }
}
