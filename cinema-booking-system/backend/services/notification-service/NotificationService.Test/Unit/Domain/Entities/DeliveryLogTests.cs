using System;
using FluentAssertions;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using Xunit;

namespace NotificationService.Test.Domain.Entities;

public class DeliveryLogTests
{
    [Fact]
    public void Constructor_ShouldCreateDeliveryLog_WhenParametersAreValid()
    {
        // Arrange & Act
        var log = new DeliveryLog("NOTIF_123", 1, DeliveryStatus.SENT, "Success");

        // Assert
        log.NotificationId.Should().Be("NOTIF_123");
        log.Attempt.Should().Be(1);
        log.Status.Should().Be(DeliveryStatus.SENT);
        log.ProviderResponse.Should().Be("Success");
        log.Timestamp.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
        log.Id.Should().BeEmpty();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Constructor_ShouldThrowArgumentException_WhenNotificationIdIsInvalid(string? invalidId)
    {
        // Act
        var act = () => new DeliveryLog(invalidId!, 1, DeliveryStatus.FAILED, "Error");

        // Assert
        act.Should().Throw<ArgumentException>().WithMessage("*NotificationId is required.*");
    }
}
