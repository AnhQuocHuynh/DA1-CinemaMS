using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using NotificationService.Application.Exceptions;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using Xunit;

namespace NotificationService.Test.Application.Features.Notifications;

public class RetryFailedNotificationCommandHandlerTests
{
    private readonly Mock<INotificationRepository> _notificationRepositoryMock;
    private readonly RetryFailedNotificationCommandHandler _handler;

    public RetryFailedNotificationCommandHandlerTests()
    {
        _notificationRepositoryMock = new Mock<INotificationRepository>();
        _handler = new RetryFailedNotificationCommandHandler(_notificationRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldMarkForRetryAndSave_WhenNotificationExists()
    {
        // Arrange
        var command = new RetryFailedNotificationCommand("NOTIF_1");
        var notification = new Notification(123, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.EMAIL, "Sub", "Body", null);

        // Force it to a state where it can be retried (e.g., FAILED)
        notification.MarkAsFailed("Test failure");

        _notificationRepositoryMock
            .Setup(x => x.GetByIdAsync(command.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notification);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        notification.Status.Should().Be(DeliveryStatus.PENDING); // MarkForRetry sets it back to pending
        _notificationRepositoryMock.Verify(x => x.UpdateAsync(notification, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrowNotificationNotFoundException_WhenNotificationDoesNotExist()
    {
        // Arrange
        var command = new RetryFailedNotificationCommand("NON_EXISTENT");

        _notificationRepositoryMock
            .Setup(x => x.GetByIdAsync(command.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification?)null);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotificationNotFoundException>()
            .WithMessage("*NON_EXISTENT*");

        _notificationRepositoryMock.Verify(x => x.UpdateAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
