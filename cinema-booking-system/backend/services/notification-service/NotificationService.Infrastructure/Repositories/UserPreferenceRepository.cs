using System.Threading;
using System.Threading.Tasks;
using MongoDB.Driver;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Interfaces;
using NotificationService.Infrastructure.Data;

namespace NotificationService.Infrastructure.Repositories;

public class UserPreferenceRepository : IUserPreferenceRepository
{
    private readonly MongoDbContext _context;

    public UserPreferenceRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task<UserPreference?> GetByUserIdAsync(long userId, CancellationToken cancellationToken = default)
    {
        return await _context.UserPreferences
            .Find(p => p.UserId == userId)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task UpsertAsync(UserPreference preference, CancellationToken cancellationToken = default)
    {
        await _context.UserPreferences.ReplaceOneAsync(
            Builders<UserPreference>.Filter.Eq(p => p.UserId, preference.UserId),
            preference,
            new ReplaceOptions { IsUpsert = true },
            cancellationToken);
    }
}
