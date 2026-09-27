using System.Threading;
using System.Threading.Tasks;

namespace NotificationService.Application.Contracts;

public interface ISmsSender
{
    Task SendSmsAsync(string phoneNumber, string message, CancellationToken cancellationToken = default);
}
