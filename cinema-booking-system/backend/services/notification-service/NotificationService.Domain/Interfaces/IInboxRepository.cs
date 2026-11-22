using System.Threading;
using System.Threading.Tasks;
using NotificationService.Domain.Entities;

namespace NotificationService.Domain.Interfaces;

public interface IInboxRepository
{
    Task<bool> TryAcquireAsync(string messageId, string consumerName, string eventType, CancellationToken cancellationToken = default);
    Task MarkProcessedAsync(string messageId, string consumerName, CancellationToken cancellationToken = default);
    Task MarkFailedAsync(string messageId, string consumerName, string errorMessage, CancellationToken cancellationToken = default);
    Task<InboxMessage?> GetAsync(string messageId, string consumerName, CancellationToken cancellationToken = default);
}
