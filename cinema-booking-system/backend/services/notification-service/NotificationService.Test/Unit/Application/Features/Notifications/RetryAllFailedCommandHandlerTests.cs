using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Domain.Interfaces;
using Xunit;

namespace NotificationService.Test.Application.Features.Notifications;

public class RetryAllFailedCommandHandlerTests
{
    private readonly Mock<INotificationRepository> _notificationRepositoryMock;
    private readonly RetryAllFailedCommandHandler _handler;

    public RetryAllFailedCommandHandlerTests()
    {
        _notificationRepositoryMock = new Mock<INotificationRepository>();
        _handler = new RetryAllFailedCommandHandler(_notificationRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnCountOfResetNotifications()
    {
        // Arrange
        _notificationRepositoryMock
            .Setup(r => r.ResetAllFailedToPendingAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(5);
        var command = new RetryAllFailedCommand();

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().Be(5);
        _notificationRepositoryMock.Verify(
            r => r.ResetAllFailedToPendingAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldReturnZero_WhenNoFailedNotifications()
    {
        // Arrange
        _notificationRepositoryMock
            .Setup(r => r.ResetAllFailedToPendingAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);
        var command = new RetryAllFailedCommand();

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().Be(0);
    }
}
