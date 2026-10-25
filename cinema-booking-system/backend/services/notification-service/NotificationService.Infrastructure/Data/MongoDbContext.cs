using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Bson.IO;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;
using MongoDB.Driver;
using NotificationService.Domain.Entities;
using System.Text.Json;

namespace NotificationService.Infrastructure.Data;

public class MongoDbContext
{
    private readonly IMongoDatabase _database;

    static MongoDbContext()
    {
        // Register ObjectSerializer to allow all types (needed for Dictionary<string, object>)
#pragma warning disable CS0618 // ObjectSerializer.AllAllowedTypes is obsolete but required for polymorphic serialization
        BsonSerializer.RegisterSerializer(new ObjectSerializer(ObjectSerializer.AllAllowedTypes));
#pragma warning restore CS0618

        // Register a custom serializer for System.Text.Json.JsonElement
        BsonSerializer.RegisterSerializer(typeof(JsonElement), new JsonElementBsonSerializer());
    }

    public MongoDbContext(IOptions<MongoDbSettings> settings)
    {
        var client = new MongoClient(settings.Value.ConnectionString);
        _database = client.GetDatabase(settings.Value.DatabaseName);

        ConfigureIndexes();
    }

    public IMongoCollection<Notification> Notifications => _database.GetCollection<Notification>("notifications");
    public IMongoCollection<NotificationTemplate> Templates => _database.GetCollection<NotificationTemplate>("notification_templates");
    public IMongoCollection<DeliveryLog> DeliveryLogs => _database.GetCollection<DeliveryLog>("delivery_logs");
    public IMongoCollection<UserPreference> UserPreferences => _database.GetCollection<UserPreference>("user_preferences");
    public IMongoCollection<InboxMessage> InboxMessages => _database.GetCollection<InboxMessage>("inbox_messages");

    private void ConfigureIndexes()
    {
        // Notifications Indexes
        var notificationIndexBuilder = Builders<Notification>.IndexKeys;
        
        var userIdCreatedAt = new CreateIndexModel<Notification>(
            notificationIndexBuilder.Ascending(x => x.UserId).Descending(x => x.CreatedAt));
            
        var statusIndex = new CreateIndexModel<Notification>(
            notificationIndexBuilder.Ascending(x => x.Status));
            
        var ttlIndex = new CreateIndexModel<Notification>(
            notificationIndexBuilder.Ascending(x => x.CreatedAt),
            new CreateIndexOptions { ExpireAfter = TimeSpan.FromDays(30) });
            
        // Idempotency: unique index on Type + metadata.orderId (only if metadata.orderId exists)
        var idempotencyIndex = new CreateIndexModel<Notification>(
            notificationIndexBuilder.Ascending(x => x.Type).Ascending("Metadata.orderId"),
            new CreateIndexOptions<Notification> 
            { 
                Unique = true, 
                PartialFilterExpression = Builders<Notification>.Filter.Exists("Metadata.orderId")
            });

        Notifications.Indexes.CreateMany(new[] { userIdCreatedAt, statusIndex, ttlIndex, idempotencyIndex });

        // Templates Indexes
        var templateIndexBuilder = Builders<NotificationTemplate>.IndexKeys;
        var codeUniqueIndex = new CreateIndexModel<NotificationTemplate>(
            templateIndexBuilder.Ascending(x => x.Code),
            new CreateIndexOptions { Unique = true });
        
        Templates.Indexes.CreateOne(codeUniqueIndex);

        // Delivery Logs Indexes
        var deliveryLogIndexBuilder = Builders<DeliveryLog>.IndexKeys;
        var notificationIdIndex = new CreateIndexModel<DeliveryLog>(
            deliveryLogIndexBuilder.Ascending(x => x.NotificationId));
            
        DeliveryLogs.Indexes.CreateOne(notificationIdIndex);
        
        // User Preferences Indexes
        var userPrefIndexBuilder = Builders<UserPreference>.IndexKeys;
        var userPrefIndex = new CreateIndexModel<UserPreference>(
            userPrefIndexBuilder.Ascending(x => x.UserId),
            new CreateIndexOptions { Unique = true });
            
        UserPreferences.Indexes.CreateOne(userPrefIndex);

        // Inbox Messages Indexes
        var inboxIndexBuilder = Builders<InboxMessage>.IndexKeys;
        var inboxUniqueIndex = new CreateIndexModel<InboxMessage>(
            inboxIndexBuilder.Ascending(x => x.MessageId).Ascending(x => x.ConsumerName),
            new CreateIndexOptions { Unique = true });

        var inboxTtlIndex = new CreateIndexModel<InboxMessage>(
            inboxIndexBuilder.Ascending(x => x.ReceivedAt),
            new CreateIndexOptions { ExpireAfter = TimeSpan.FromDays(14) });

        InboxMessages.Indexes.CreateMany(new[] { inboxUniqueIndex, inboxTtlIndex });
    }
}
