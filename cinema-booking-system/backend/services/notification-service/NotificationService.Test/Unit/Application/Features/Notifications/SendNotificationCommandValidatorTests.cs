using System.Collections.Generic;
using FluentAssertions;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Domain.Enums;
using Xunit;

namespace NotificationService.Test.Application.Features.Notifications;

public class SendNotificationCommandValidatorTests
{
    private readonly SendNotificationCommandValidator _validator;

    public SendNotificationCommandValidatorTests()
    {
        _validator = new SendNotificationCommandValidator();
    }

    [Fact]
    public void Validate_ShouldPass_WhenCommandIsValid()
    {
        // Arrange
        var command = new SendNotificationCommand(
            123,
            NotificationType.BOOKING_CONFIRMATION,
            NotificationChannel.EMAIL,
            "Title",
            "Body",
            new Dictionary<string, object>()
        );

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_ShouldFail_WhenUserIdIsInvalid()
    {
        // Arrange
        var command = new SendNotificationCommand(
            0,
            NotificationType.BOOKING_CONFIRMATION,
            NotificationChannel.EMAIL,
            "Title",
            "Body",
            null!
        );

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "UserId");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_ShouldFail_WhenTitleIsInvalid(string? invalidTitle)
    {
        // Arrange
        var command = new SendNotificationCommand(
            123,
            NotificationType.BOOKING_CONFIRMATION,
            NotificationChannel.EMAIL,
            invalidTitle!,
            "Body",
            null!
        );

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Title");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_ShouldFail_WhenBodyIsInvalid(string? invalidBody)
    {
        // Arrange
        var command = new SendNotificationCommand(
            123,
            NotificationType.BOOKING_CONFIRMATION,
            NotificationChannel.EMAIL,
            "Title",
            invalidBody!,
            null!
        );

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Body");
    }

    [Fact]
    public void Validate_ShouldFail_WhenTypeIsInvalid()
    {
        // Arrange
        var command = new SendNotificationCommand(
            123,
            (NotificationType)999,
            NotificationChannel.EMAIL,
            "Title",
            "Body",
            null!
        );

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Type");
    }
}
