using FluentAssertions;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Enums;
using System;
using Xunit;

namespace IdentityService.Test.Unit.Entities;

public class UserTests
{
    [Fact]
    public void UpdateProfile_ShouldUpdateFieldsAndSetUpdatedAt()
    {
        // Arrange
        var user = new User("test-uuid", "test@example.com", "Test User");
        typeof(User).GetProperty("Id")?.SetValue(user, 1L);
        var newPhone = "1234567890";
        var newGender = Gender.MALE;
        var newDob = new DateTime(1990, 1, 1);

        // Act
        user.UpdateProfile(newPhone, newGender, newDob);

        // Assert
        user.Phone.Should().Be(newPhone);
        user.Gender.Should().Be(newGender);
        user.DateOfBirth.Should().Be(newDob);
        user.UpdatedAt.Should().NotBeNull();
        user.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void SyncKeycloakData_ShouldUpdateFieldsAndSetUpdatedAt()
    {
        // Arrange
        var user = new User("test-uuid", "old@example.com", "Old Name");
        typeof(User).GetProperty("Id")?.SetValue(user, 1L);
        var newEmail = "new@example.com";
        var newName = "New Name";

        // Act
        user.SyncKeycloakData(newEmail, newName, true);

        // Assert
        user.Email.Should().Be(newEmail);
        user.FullName.Should().Be(newName);
        user.Active.Should().BeTrue();
        user.UpdatedAt.Should().NotBeNull();
        user.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }
}
