using FluentAssertions;
using NotificationService.Application.Features.Notifications.Commands;
using Xunit;

namespace NotificationService.Test.Application.Features.Notifications;

public class RetryFailedNotificationCommandValidatorTests
{
    private readonly RetryFailedNotificationCommandValidator _validator;

    public RetryFailedNotificationCommandValidatorTests()
    {
        _validator = new RetryFailedNotificationCommandValidator();
    }

    [Fact]
    public void Validate_ShouldPass_WhenCommandIsValid()
    {
        // Arrange
        var command = new RetryFailedNotificationCommand("NOTIF_1");

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_ShouldFail_WhenIdIsInvalid(string? invalidId)
    {
        // Arrange
        var command = new RetryFailedNotificationCommand(invalidId!);

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Id");
    }
}
