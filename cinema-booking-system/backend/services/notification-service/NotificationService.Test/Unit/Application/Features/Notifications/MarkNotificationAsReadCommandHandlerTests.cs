using System;
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

namespace NotificationService.Test.Unit.Application.Features.Notifications;

public class MarkNotificationAsReadCommandHandlerTests
{
    private readonly Mock<INotificationRepository> _notifRepoMock;
    private readonly MarkNotificationAsReadCommandHandler _handler;

    public MarkNotificationAsReadCommandHandlerTests()
    {
        _notifRepoMock = new Mock<INotificationRepository>();
        _handler = new MarkNotificationAsReadCommandHandler(_notifRepoMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldThrowNotificationNotFoundException_WhenNotificationDoesNotExist()
    {
        // Arrange
        const string notifId = "notif-999";
        _notifRepoMock.Setup(r => r.GetByIdAsync(notifId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification?)null);

        var command = new MarkNotificationAsReadCommand(notifId, 100);

        // Act & Assert
        var act = () => _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<NotificationNotFoundException>();
    }

    [Fact]
    public async Task Handle_ShouldThrowUnauthorizedAccessException_WhenUserDoesNotMatch()
    {
        // Arrange
        const string notifId = "notif-100";
        var notification = new Notification(100, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.PUSH, "Title", "Body");
        _notifRepoMock.Setup(r => r.GetByIdAsync(notifId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notification);

        var command = new MarkNotificationAsReadCommand(notifId, 999); // different user

        // Act & Assert
        var act = () => _handler.Handle(command, CancellationToken.None);
        await act.Should().ThrowAsync<UnauthorizedAccessException>();
    }

    [Fact]
    public async Task Handle_ShouldMarkNotificationAsRead_WhenRequestIsValid()
    {
        // Arrange
        const string notifId = "notif-100";
        var notification = new Notification(100, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.PUSH, "Title", "Body");
        notification.IsRead.Should().BeFalse();
        notification.ReadAt.Should().BeNull();

        _notifRepoMock.Setup(r => r.GetByIdAsync(notifId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notification);

        var command = new MarkNotificationAsReadCommand(notifId, 100);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        notification.IsRead.Should().BeTrue();
        notification.ReadAt.Should().NotBeNull();
        _notifRepoMock.Verify(r => r.UpdateAsync(notification, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("", 100, false)]
    [InlineData("notif-1", 0, false)]
    [InlineData("notif-1", -5, false)]
    [InlineData("notif-1", 100, true)]
    public void Validator_ShouldValidateCorrectly(string id, long userId, bool expectedValid)
    {
        var validator = new MarkNotificationAsReadCommandValidator();
        var command = new MarkNotificationAsReadCommand(id, userId);

        var result = validator.Validate(command);

        result.IsValid.Should().Be(expectedValid);
    }
}
