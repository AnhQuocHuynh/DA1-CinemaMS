using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;

namespace NotificationService.Domain.Interfaces;

public interface INotificationRepository
{
    Task InsertAsync(Notification notification, CancellationToken cancellationToken = default);
    Task UpdateAsync(Notification notification, CancellationToken cancellationToken = default);
    Task<Notification?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<IEnumerable<Notification>> GetByUserIdAsync(long userId, CancellationToken cancellationToken = default);
    Task<(IEnumerable<Notification> Items, long TotalCount)> GetPagedAsync(int page, int pageSize, CancellationToken cancellationToken = default);
    Task<int> ResetAllFailedToPendingAsync(CancellationToken cancellationToken = default);
}
