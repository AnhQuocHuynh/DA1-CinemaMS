using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Contracts;
using NotificationService.Domain.Enums;

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

    public async Task SendPushAsync(
        string id,
        long userId,
        NotificationType type,
        string title,
        string body,
        Dictionary<string, object>? metadata = null,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Sending PUSH to User {UserId} ({Type}): {Title}", userId, type, title);

        var payload = new
        {
            id,
            userId,
            type = type.ToString(),
            title,
            body,
            timestamp = DateTime.UtcNow.ToString("o"),
            metadata = metadata ?? new Dictionary<string, object>()
        };

        // Send to the user's group (clients join a group named after their userId on connect)
        await _hubContext.Clients.Group(userId.ToString())
            .SendAsync("ReceiveNotification", payload, cancellationToken);
    }
}
