using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using NotificationService.Domain.Entities;

namespace NotificationService.Domain.Interfaces;

public interface IDeliveryLogRepository
{
    Task InsertAsync(DeliveryLog log, CancellationToken cancellationToken = default);
    Task<IEnumerable<DeliveryLog>> GetByNotificationIdAsync(string notificationId, CancellationToken cancellationToken = default);
}
