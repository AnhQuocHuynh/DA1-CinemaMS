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
    private readonly IConfiguration _configuration;
    private IConnection? _connection;
    private IChannel? _channel;

    public KeycloakUserDeletedConsumer(
        IServiceProvider serviceProvider,
        ILogger<KeycloakUserDeletedConsumer> logger,
        IConfiguration configuration)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var hostName = _configuration["RabbitMQ:HostName"] ?? "localhost";
        var userName = _configuration["RabbitMQ:UserName"] ?? "guest";
        var password = _configuration["RabbitMQ:Password"] ?? "guest";

        var factory = new ConnectionFactory
        {
            HostName = hostName,
            UserName = userName,
            Password = password
        };

        try
        {
            _connection = await factory.CreateConnectionAsync(stoppingToken);
            _channel = await _connection.CreateChannelAsync(cancellationToken: stoppingToken);
            var queueName = "identity-service.user-deleted";
            var exchangeName = "user.events";
            var routingKey = "user.deleted";

            await _channel.QueueDeclareAsync(queue: queueName, durable: true, exclusive: false, autoDelete: false, arguments: null, cancellationToken: stoppingToken);
            await _channel.QueueBindAsync(queue: queueName, exchange: exchangeName, routingKey: routingKey, cancellationToken: stoppingToken);
            
            _logger.LogInformation("Connected to RabbitMQ on {HostName} and listening to {QueueName}", hostName, queueName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not connect to RabbitMQ broker");
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

        await _channel.BasicConsumeAsync(queue: "identity-service.user-deleted", autoAck: false, consumer: consumer, cancellationToken: stoppingToken);

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
        if (_connection != null)
        {
            await _connection.CloseAsync(cancellationToken);
        }
        await base.StopAsync(cancellationToken);
    }
}

public class KeycloakDeletePayload
{
    public string KeycloakId { get; set; } = string.Empty;
}
