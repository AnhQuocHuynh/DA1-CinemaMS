using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MongoDB.Driver;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Interfaces;
using NotificationService.Infrastructure.Data;

namespace NotificationService.Infrastructure.Repositories;

public class DeliveryLogRepository : IDeliveryLogRepository
{
    private readonly MongoDbContext _context;

    public DeliveryLogRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task InsertAsync(DeliveryLog log, CancellationToken cancellationToken = default)
    {
        await _context.DeliveryLogs.InsertOneAsync(log, new InsertOneOptions(), cancellationToken);
    }

    public async Task<IEnumerable<DeliveryLog>> GetByNotificationIdAsync(string notificationId, CancellationToken cancellationToken = default)
    {
        return await _context.DeliveryLogs
            .Find(l => l.NotificationId == notificationId)
            .SortByDescending(l => l.Timestamp)
            .ToListAsync(cancellationToken);
    }
}
