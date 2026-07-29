using IdentityService.Application.Contracts;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Infrastructure.Messaging.Publishers;

public class RabbitMqEventPublisher : IEventPublisher
{
    private readonly IRabbitMQConnectionProvider _connectionProvider;
    private readonly ILogger<RabbitMqEventPublisher> _logger;

    public RabbitMqEventPublisher(IRabbitMQConnectionProvider connectionProvider, ILogger<RabbitMqEventPublisher> logger)
    {
        _connectionProvider = connectionProvider;
        _logger = logger;
    }

    public async Task PublishAsync<T>(T @event, CancellationToken ct = default) where T : class
    {
        try
        {
            var connection = await _connectionProvider.GetConnectionAsync(ct);
            await using var channel = await connection.CreateChannelAsync(cancellationToken: ct);

            // Using the exchange defined in the refactor plan
            var exchangeName = "user.events";
            
            // Derive routing key based on event type (you can customize this mapping)
            var routingKey = @event.GetType().Name switch
            {
                "UserProfileUpdatedPayload" => "user.profile.updated",
                _ => "user.unknown"
            };

            var message = JsonSerializer.Serialize(@event);
            var body = Encoding.UTF8.GetBytes(message);

            // We ensure the exchange exists
            await channel.ExchangeDeclareAsync(exchange: exchangeName, type: ExchangeType.Topic, durable: true, autoDelete: false, arguments: null, cancellationToken: ct);

            await channel.BasicPublishAsync(
                exchange: exchangeName,
                routingKey: routingKey,
                body: body,
                cancellationToken: ct);

            _logger.LogInformation("Published event {EventName} to exchange {ExchangeName}", @event.GetType().Name, exchangeName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not publish event {EventName} to RabbitMQ", @event.GetType().Name);
        }
    }
}
