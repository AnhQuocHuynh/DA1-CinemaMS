using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using NotificationService.Infrastructure.Data;

namespace NotificationService.Infrastructure.Repositories;

public class InboxRepository : IInboxRepository
{
    private readonly MongoDbContext _context;
    private readonly ILogger<InboxRepository> _logger;

    public InboxRepository(MongoDbContext context, ILogger<InboxRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<bool> TryAcquireAsync(string messageId, string consumerName, string eventType, CancellationToken cancellationToken = default)
    {
        var inboxMessage = new InboxMessage(messageId, consumerName, eventType);

        try
        {
            await _context.InboxMessages.InsertOneAsync(inboxMessage, new InsertOneOptions(), cancellationToken);
            return true;
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            _logger.LogInformation("Duplicate inbox message detected for MessageId: {MessageId}, Consumer: {ConsumerName}", messageId, consumerName);
            return false;
        }
    }

    public async Task MarkProcessedAsync(string messageId, string consumerName, CancellationToken cancellationToken = default)
    {
        var filter = Builders<InboxMessage>.Filter.And(
            Builders<InboxMessage>.Filter.Eq(x => x.MessageId, messageId),
            Builders<InboxMessage>.Filter.Eq(x => x.ConsumerName, consumerName));

        var update = Builders<InboxMessage>.Update
            .Set(x => x.Status, InboxStatus.Processed)
            .Set(x => x.ProcessedAt, DateTime.UtcNow)
            .Set(x => x.ErrorMessage, null);

        await _context.InboxMessages.UpdateOneAsync(filter, update, cancellationToken: cancellationToken);
    }

    public async Task MarkFailedAsync(string messageId, string consumerName, string errorMessage, CancellationToken cancellationToken = default)
    {
        var filter = Builders<InboxMessage>.Filter.And(
            Builders<InboxMessage>.Filter.Eq(x => x.MessageId, messageId),
            Builders<InboxMessage>.Filter.Eq(x => x.ConsumerName, consumerName));

        var update = Builders<InboxMessage>.Update
            .Set(x => x.Status, InboxStatus.Failed)
            .Set(x => x.ErrorMessage, errorMessage);

        await _context.InboxMessages.UpdateOneAsync(filter, update, cancellationToken: cancellationToken);
    }

    public async Task<InboxMessage?> GetAsync(string messageId, string consumerName, CancellationToken cancellationToken = default)
    {
        var filter = Builders<InboxMessage>.Filter.And(
            Builders<InboxMessage>.Filter.Eq(x => x.MessageId, messageId),
            Builders<InboxMessage>.Filter.Eq(x => x.ConsumerName, consumerName));

        return await _context.InboxMessages.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }
}
