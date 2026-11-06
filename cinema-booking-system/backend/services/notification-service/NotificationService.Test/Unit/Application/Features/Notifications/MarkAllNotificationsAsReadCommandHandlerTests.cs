using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Domain.Interfaces;
using Xunit;

namespace NotificationService.Test.Unit.Application.Features.Notifications;

public class MarkAllNotificationsAsReadCommandHandlerTests
{
    private readonly Mock<INotificationRepository> _notifRepoMock;
    private readonly MarkAllNotificationsAsReadCommandHandler _handler;

    public MarkAllNotificationsAsReadCommandHandlerTests()
    {
        _notifRepoMock = new Mock<INotificationRepository>();
        _handler = new MarkAllNotificationsAsReadCommandHandler(_notifRepoMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldCallMarkAllAsReadAsync_WithUserId()
    {
        // Arrange
        const long userId = 77;
        var command = new MarkAllNotificationsAsReadCommand(userId);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _notifRepoMock.Verify(r => r.MarkAllAsReadAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(-1, false)]
    [InlineData(1, true)]
    [InlineData(77, true)]
    public void Validator_ShouldValidateCorrectly(long userId, bool expectedValid)
    {
        var validator = new MarkAllNotificationsAsReadCommandValidator();
        var command = new MarkAllNotificationsAsReadCommand(userId);

        var result = validator.Validate(command);

        result.IsValid.Should().Be(expectedValid);
    }
}
