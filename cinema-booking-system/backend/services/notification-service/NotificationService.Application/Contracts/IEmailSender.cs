using System.Threading;
using System.Threading.Tasks;

namespace NotificationService.Application.Contracts;

public interface IEmailSender
{
    Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default);
}
