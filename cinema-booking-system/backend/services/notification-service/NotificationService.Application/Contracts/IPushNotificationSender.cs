using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using NotificationService.Domain.Enums;

namespace NotificationService.Application.Contracts;

public interface IPushNotificationSender
{
    Task SendPushAsync(
        string id,
        long userId,
        NotificationType type,
        string title,
        string body,
        Dictionary<string, object>? metadata = null,
        CancellationToken cancellationToken = default);
}
