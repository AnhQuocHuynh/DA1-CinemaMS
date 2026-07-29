using IdentityService.Application.Features.KeycloakSync.Commands;
using MediatR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;

namespace IdentityService.Infrastructure.Messaging.Consumers;

public class KeycloakUserDeletedConsumer : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<KeycloakUserDeletedConsumer> _logger;
    private readonly IRabbitMQConnectionProvider _connectionProvider;
    private IConnection? _connection;
    private IChannel? _channel;
    private const string QUEUE_NAME = "identity-service.user-deleted";
    private const string EXCHANGE_NAME = "user.events";
    private const string ROUTING_KEY = "user.deleted";

    public KeycloakUserDeletedConsumer(
        IServiceProvider serviceProvider,
        ILogger<KeycloakUserDeletedConsumer> logger,
        IRabbitMQConnectionProvider connectionProvider)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _connectionProvider = connectionProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            _connection = await _connectionProvider.GetConnectionAsync(stoppingToken);
            _channel = await _connection.CreateChannelAsync(cancellationToken: stoppingToken);

            await _channel.ExchangeDeclareAsync(exchange: EXCHANGE_NAME, type: ExchangeType.Topic, durable: true, autoDelete: false, arguments: null, cancellationToken: stoppingToken);
            await _channel.QueueDeclareAsync(queue: QUEUE_NAME, durable: true, exclusive: false, autoDelete: false, arguments: null, cancellationToken: stoppingToken);
            await _channel.QueueBindAsync(queue: QUEUE_NAME, exchange: EXCHANGE_NAME, routingKey: ROUTING_KEY, cancellationToken: stoppingToken);
            
            _logger.LogInformation("Connected to RabbitMQ and listening to {QueueName}", QUEUE_NAME);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to RabbitMQ broker");
            return;
        }

        if (_channel == null)
        {
            return;
        }

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.ReceivedAsync += async (model, ea) =>
        {
            try
            {
                var body = ea.Body.ToArray();
                var message = Encoding.UTF8.GetString(body);
                
                _logger.LogInformation("Received Keycloak Delete Event: {Message}", message);

                var payload = JsonSerializer.Deserialize<KeycloakDeletePayload>(message);

                if (payload != null && !string.IsNullOrEmpty(payload.KeycloakId))
                {
                    var command = new DeleteUserFromKeycloakEventCommand(payload.KeycloakId);

                    using var scope = _serviceProvider.CreateScope();
                    var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

                    await mediator.Send(command, stoppingToken);
                }

                await _channel.BasicAckAsync(ea.DeliveryTag, false, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Keycloak Delete Event");
                await _channel.BasicNackAsync(ea.DeliveryTag, false, requeue: false, stoppingToken);
            }
        };

        await _channel.BasicConsumeAsync(queue: QUEUE_NAME, autoAck: false, consumer: consumer, cancellationToken: stoppingToken);

        // Keep the background service running
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(1000, stoppingToken);
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_channel != null)
        {
            await _channel.CloseAsync(cancellationToken);
        }
        await base.StopAsync(cancellationToken);
    }
}

public class KeycloakDeletePayload
{
    public string KeycloakId { get; set; } = string.Empty;
}
