using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using NotificationService.Application.Features.Notifications.Commands;
using Xunit;

namespace NotificationService.Test.Application.Features.Notifications;

public class RetryAllFailedCommandHandlerTests
{
    private readonly RetryAllFailedCommandHandler _handler;

    public RetryAllFailedCommandHandlerTests()
    {
        _handler = new RetryAllFailedCommandHandler();
    }

    [Fact]
    public async Task Handle_ShouldReturnZero_AsStub()
    {
        // Arrange
        var command = new RetryAllFailedCommand();

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().Be(0);
    }
}
