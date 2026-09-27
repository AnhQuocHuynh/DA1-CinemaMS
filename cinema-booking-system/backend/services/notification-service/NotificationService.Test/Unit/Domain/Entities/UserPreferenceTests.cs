using System;
using FluentAssertions;
using NotificationService.Domain.Entities;
using NotificationService.Domain.ValueObjects;
using Xunit;

namespace NotificationService.Test.Unit.Domain.Entities;

public class UserPreferenceTests
{
    [Fact]
    public void Constructor_ShouldInitializeWithDefaults_WhenOnlyUserIdProvided()
    {
        // Act
        var pref = new UserPreference(123);

        // Assert
        pref.UserId.Should().Be(123);
        pref.Contact.Should().BeNull();
        pref.EmailEnabled.Should().BeTrue();
        pref.SmsEnabled.Should().BeTrue();
        pref.PushEnabled.Should().BeTrue();
    }

    [Fact]
    public void Constructor_ShouldInitializeWithContactDetails()
    {
        // Act
        var contact = new ContactDetails("test@test.com");
        var pref = new UserPreference(123, contact);

        // Assert
        pref.Contact.Should().Be(contact);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Constructor_ShouldThrowArgumentException_WhenUserIdIsInvalid(long invalidUserId)
    {
        // Act
        var act = () => new UserPreference(invalidUserId);

        // Assert
        act.Should().Throw<ArgumentException>().WithMessage("*UserId must be greater than zero.*");
    }

    [Fact]
    public void UpdatePreferences_ShouldUpdateValues()
    {
        // Arrange
        var pref = new UserPreference(123);
        var contact = new ContactDetails("new@test.com");

        // Act
        pref.UpdatePreferences(contact, false, true, false);

        // Assert
        pref.Contact.Should().Be(contact);
        pref.EmailEnabled.Should().BeFalse();
        pref.SmsEnabled.Should().BeTrue();
        pref.PushEnabled.Should().BeFalse();
    }
}
