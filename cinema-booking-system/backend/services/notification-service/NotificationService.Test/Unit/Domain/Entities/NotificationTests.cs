using System;
using FluentAssertions;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using Xunit;

namespace NotificationService.Test.Domain.Entities;

public class NotificationTests
{
    [Fact]
    public void Constructor_WithValidArguments_SetsInitialState()
    {
        // Arrange
        long userId = 1;
        var type = NotificationType.BOOKING_CONFIRMATION;
        var channel = NotificationChannel.EMAIL;
        string title = "Test Title";
        string body = "Test Body";

        // Act
        var notification = new Notification(userId, type, channel, title, body);

        // Assert
        notification.UserId.Should().Be(userId);
        notification.Type.Should().Be(type);
        notification.Channel.Should().Be(channel);
        notification.Title.Should().Be(title);
        notification.Body.Should().Be(body);
        
        // Assert initial state
        notification.Status.Should().Be(DeliveryStatus.PENDING);
        notification.RetryCount.Should().Be(0);
        notification.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
        notification.SentAt.Should().BeNull();
        notification.FailedReason.Should().BeNull();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Constructor_WithInvalidUserId_ThrowsArgumentException(long invalidUserId)
    {
        Action act = () => new Notification(invalidUserId, NotificationType.PROMOTIONAL, NotificationChannel.PUSH, "Title", "Body");
        act.Should().Throw<ArgumentException>().WithParameterName("userId");
    }

    [Fact]
    public void MarkAsSent_UpdatesStatusAndTimestamp()
    {
        // Arrange
        var notification = new Notification(1, NotificationType.PROMOTIONAL, NotificationChannel.EMAIL, "T", "B");

        // Act
        notification.MarkAsSent();

        // Assert
        notification.Status.Should().Be(DeliveryStatus.SENT);
        notification.SentAt.Should().NotBeNull();
        notification.SentAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
        notification.FailedReason.Should().BeNull();
    }

    [Fact]
    public void MarkAsFailed_UpdatesStatusAndReason()
    {
        // Arrange
        var notification = new Notification(1, NotificationType.PROMOTIONAL, NotificationChannel.EMAIL, "T", "B");
        string reason = "SMTP Timeout";

        // Act
        notification.MarkAsFailed(reason);

        // Assert
        notification.Status.Should().Be(DeliveryStatus.FAILED);
        notification.FailedReason.Should().Be(reason);
        notification.SentAt.Should().BeNull();
    }

    [Fact]
    public void MarkForRetry_WhenFailed_ResetsStatusToPending()
    {
        // Arrange
        var notification = new Notification(1, NotificationType.PROMOTIONAL, NotificationChannel.EMAIL, "T", "B");
        notification.MarkAsFailed("Error");

        // Act
        notification.MarkForRetry();

        // Assert
        notification.Status.Should().Be(DeliveryStatus.PENDING);
    }

    [Fact]
    public void MarkForRetry_WhenNotFailed_ThrowsInvalidOperationException()
    {
        // Arrange
        var notification = new Notification(1, NotificationType.PROMOTIONAL, NotificationChannel.EMAIL, "T", "B");
        // Status is PENDING

        // Act
        Action act = () => notification.MarkForRetry();

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }
}
