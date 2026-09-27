using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using Xunit;

namespace NotificationService.Test.Unit.Application.Features.Notifications;

public class SendNotificationCommandHandlerTests
{
    private readonly Mock<INotificationRepository> _notifRepoMock;
    private readonly Mock<IUserPreferenceRepository> _prefRepoMock;
    private readonly SendNotificationCommandHandler _handler;

    public SendNotificationCommandHandlerTests()
    {
        _notifRepoMock = new Mock<INotificationRepository>();
        _prefRepoMock = new Mock<IUserPreferenceRepository>();
        _handler = new SendNotificationCommandHandler(_notifRepoMock.Object, _prefRepoMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldSkip_WhenChannelIsDisabled()
    {
        // Arrange
        var pref = new UserPreference(123, emailEnabled: false);
        _prefRepoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync(pref);

        var command = new SendNotificationCommand(123, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.EMAIL, "Title", "Body", new Dictionary<string, object>());

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().Be("Skipped due to user preference");
        _notifRepoMock.Verify(x => x.InsertAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldSend_WhenChannelIsEnabled()
    {
        // Arrange
        var pref = new UserPreference(123, emailEnabled: true);
        _prefRepoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync(pref);

        var command = new SendNotificationCommand(123, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.EMAIL, "Title", "Body", new Dictionary<string, object>());

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBe("Skipped due to user preference");
        _notifRepoMock.Verify(x => x.InsertAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldSend_WhenPreferenceDoesNotExist()
    {
        // Arrange
        _prefRepoMock.Setup(x => x.GetByUserIdAsync(123, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserPreference?)null);

        var command = new SendNotificationCommand(123, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.EMAIL, "Title", "Body", new Dictionary<string, object>());

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBe("Skipped due to user preference");
        _notifRepoMock.Verify(x => x.InsertAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
