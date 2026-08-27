using System;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace NotificationService.Infrastructure.Messaging;

public abstract class RabbitMqConsumerBase<TMessage> : BackgroundService
{
    private readonly ILogger _logger;
    private readonly IRabbitMqConnectionProvider _connectionProvider;
    private IConnection? _connection;
    private IChannel? _channel;

    protected abstract string ExchangeName { get; }
    protected abstract string QueueName { get; }
    protected abstract string RoutingKey { get; }

    protected RabbitMqConsumerBase(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger logger)
    {
        _connectionProvider = connectionProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            _connection = await _connectionProvider.GetConnectionAsync(stoppingToken);
            _channel = await _connection.CreateChannelAsync(cancellationToken: stoppingToken);

            await _channel.ExchangeDeclareAsync(exchange: ExchangeName, type: ExchangeType.Topic, durable: true, cancellationToken: stoppingToken);
            await _channel.QueueDeclareAsync(queue: QueueName, durable: true, exclusive: false, autoDelete: false, cancellationToken: stoppingToken);
            await _channel.QueueBindAsync(queue: QueueName, exchange: ExchangeName, routingKey: RoutingKey, cancellationToken: stoppingToken);

            var consumer = new AsyncEventingBasicConsumer(_channel);
            consumer.ReceivedAsync += async (model, ea) =>
            {
                var body = ea.Body.ToArray();
                var messageString = Encoding.UTF8.GetString(body);
                
                try
                {
                    var message = JsonSerializer.Deserialize<TMessage>(messageString, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    if (message != null)
                    {
                        await ProcessMessageAsync(message, stoppingToken);
                    }
                    await _channel.BasicAckAsync(deliveryTag: ea.DeliveryTag, multiple: false, cancellationToken: stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing message from queue {QueueName}", QueueName);
                    // Depending on the use-case, we might reject and requeue, or dead-letter it
                    await _channel.BasicNackAsync(deliveryTag: ea.DeliveryTag, multiple: false, requeue: false, cancellationToken: stoppingToken);
                }
            };

            await _channel.BasicConsumeAsync(queue: QueueName, autoAck: false, consumer: consumer, cancellationToken: stoppingToken);

            _logger.LogInformation("Started listening to queue {QueueName}...", QueueName);
            
            // Keep the task alive
            while (!stoppingToken.IsCancellationRequested)
            {
                await Task.Delay(1000, stoppingToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize RabbitMQ Consumer for queue {QueueName}", QueueName);
        }
    }

    protected abstract Task ProcessMessageAsync(TMessage message, CancellationToken cancellationToken);

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        // We don't close the connection here because it's shared across consumers!
        // The RabbitMqConnectionProvider will dispose of it when the application shuts down.
        
        await base.StopAsync(cancellationToken);
    }
}
