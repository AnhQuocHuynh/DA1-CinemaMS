using System.Threading;
using System.Threading.Tasks;

namespace NotificationService.Application.Contracts;

public interface IPushNotificationSender
{
    Task SendPushAsync(long userId, string title, string body, CancellationToken cancellationToken = default);
}
