using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Contracts;

namespace NotificationService.Presentation.Hubs;

/// <summary>
/// Sends real-time push notifications to connected SignalR clients.
/// Targets the user's group (keyed by userId) on the NotificationHub.
/// </summary>
public class SignalRPushSender : IPushNotificationSender
{
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ILogger<SignalRPushSender> _logger;

    public SignalRPushSender(IHubContext<NotificationHub> hubContext, ILogger<SignalRPushSender> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task SendPushAsync(long userId, string title, string body, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Sending PUSH to User {UserId}: {Title}", userId, title);

        var payload = new
        {
            userId,
            title,
            body,
            timestamp = DateTime.UtcNow
        };

        // Send to the user's group (clients join a group named after their userId on connect)
        await _hubContext.Clients.Group(userId.ToString())
            .SendAsync("ReceiveNotification", payload, cancellationToken);
    }
}
