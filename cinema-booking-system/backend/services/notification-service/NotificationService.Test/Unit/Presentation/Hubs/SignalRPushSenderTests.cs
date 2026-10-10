using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using NotificationService.Presentation.Hubs;
using Xunit;

namespace NotificationService.Test.Unit.Presentation.Hubs;

public class SignalRPushSenderTests
{
    private readonly Mock<IHubContext<NotificationHub>> _hubContextMock;
    private readonly Mock<IHubClients> _clientsMock;
    private readonly Mock<IClientProxy> _clientProxyMock;
    private readonly Mock<ILogger<SignalRPushSender>> _loggerMock;
    private readonly SignalRPushSender _sut;

    public SignalRPushSenderTests()
    {
        _hubContextMock = new Mock<IHubContext<NotificationHub>>();
        _clientsMock = new Mock<IHubClients>();
        _clientProxyMock = new Mock<IClientProxy>();
        _loggerMock = new Mock<ILogger<SignalRPushSender>>();

        _hubContextMock.Setup(h => h.Clients).Returns(_clientsMock.Object);
        _clientsMock.Setup(c => c.Group("42")).Returns(_clientProxyMock.Object);

        _sut = new SignalRPushSender(_hubContextMock.Object, _loggerMock.Object);
    }

    [Fact]
    public async Task SendPushAsync_ShouldSendNotificationToUserGroup()
    {
        // Arrange
        const long userId = 42;
        const string title = "Order Confirmed";
        const string body = "Your ticket has been booked.";

        // Act
        await _sut.SendPushAsync(userId, title, body, CancellationToken.None);

        // Assert
        _clientsMock.Verify(c => c.Group("42"), Times.Once);
        _clientProxyMock.Verify(cp => cp.SendCoreAsync(
            "ReceiveNotification",
            It.Is<object?[]>(args => args != null && args.Length == 1),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
