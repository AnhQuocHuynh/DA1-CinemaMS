using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MongoDB.Driver;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Interfaces;
using NotificationService.Infrastructure.Data;

namespace NotificationService.Infrastructure.Repositories;

public class TemplateRepository : ITemplateRepository
{
    private readonly MongoDbContext _context;

    public TemplateRepository(MongoDbContext context)
    {
        _context = context;
    }

    public async Task InsertAsync(NotificationTemplate template, CancellationToken cancellationToken = default)
    {
        await _context.Templates.InsertOneAsync(template, new InsertOneOptions(), cancellationToken);
    }

    public async Task UpdateAsync(NotificationTemplate template, CancellationToken cancellationToken = default)
    {
        await _context.Templates.ReplaceOneAsync(
            Builders<NotificationTemplate>.Filter.Eq(t => t.Id, template.Id),
            template,
            new ReplaceOptions { IsUpsert = false },
            cancellationToken);
    }

    public async Task<NotificationTemplate?> GetByCodeAsync(string code, CancellationToken cancellationToken = default)
    {
        return await _context.Templates
            .Find(t => t.Code == code)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IEnumerable<NotificationTemplate>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Templates
            .Find(_ => true)
            .ToListAsync(cancellationToken);
    }
}
