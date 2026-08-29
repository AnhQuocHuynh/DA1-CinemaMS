using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MongoDB.Driver;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Interfaces;
using NotificationService.Infrastructure.Data;

namespace NotificationService.Infrastructure.Repositories;

public class NotificationRepository : INotificationRepository
{
    private readonly MongoDbContext _context;

    public NotificationRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task InsertAsync(Notification notification, CancellationToken cancellationToken = default)
    {
        try
        {
            await _context.Notifications.InsertOneAsync(notification, new InsertOneOptions(), cancellationToken);
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            // Idempotency: Ignore duplicate key exceptions on unique indexes
        }
    }

    public async Task UpdateAsync(Notification notification, CancellationToken cancellationToken = default)
    {
        await _context.Notifications.ReplaceOneAsync(
            Builders<Notification>.Filter.Eq(n => n.Id, notification.Id),
            notification,
            new ReplaceOptions { IsUpsert = false },
            cancellationToken);
    }

    public async Task<Notification?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        return await _context.Notifications
            .Find(n => n.Id == id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IEnumerable<Notification>> GetByUserIdAsync(long userId, CancellationToken cancellationToken = default)
    {
        return await _context.Notifications
            .Find(n => n.UserId == userId)
            .SortByDescending(n => n.CreatedAt)
            .ToListAsync(cancellationToken);
    }
}
