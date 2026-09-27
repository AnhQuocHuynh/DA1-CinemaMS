using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Contracts;

namespace NotificationService.Infrastructure.Services;

// In a real application, this would inject IHubContext<NotificationHub> and send to the user's connection.
// Since the Hub is in the Presentation layer, this implementation can be a dummy logger for now or 
// use a backing pub/sub mechanism if scaling out.
public class SignalRPushSender : IPushNotificationSender
{
    private readonly ILogger<SignalRPushSender> _logger;

    public SignalRPushSender(ILogger<SignalRPushSender> logger)
    {
        _logger = logger;
    }

    public Task SendPushAsync(long userId, string title, string body, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Sending PUSH to User {UserId}: {Title} - {Body}", userId, title, body);
        return Task.CompletedTask;
    }
}
