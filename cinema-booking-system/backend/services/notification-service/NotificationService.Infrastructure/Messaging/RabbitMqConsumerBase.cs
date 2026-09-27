using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Messages;
using NotificationService.Domain.Interfaces;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace NotificationService.Infrastructure.Messaging;

public abstract class RabbitMqConsumerBase<TMessage> : BackgroundService
{
    protected readonly ILogger Logger;
    private readonly IRabbitMqConnectionProvider _connectionProvider;
    protected readonly IServiceScopeFactory ScopeFactory;
    private IConnection? _connection;
    private IChannel? _channel;

    protected abstract string ExchangeName { get; }
    protected abstract string QueueName { get; }
    protected abstract string RoutingKey { get; }

    protected RabbitMqConsumerBase(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger logger,
        IServiceScopeFactory scopeFactory)
    {
        _connectionProvider = connectionProvider;
        Logger = logger;
        ScopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
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
                    await HandleDeliveryAsync(
                        ea.Body.ToArray(),
                        ea.BasicProperties?.MessageId,
                        ea.DeliveryTag,
                        _channel.BasicAckAsync,
                        _channel.BasicNackAsync,
                        stoppingToken);
                };

                await _channel.BasicConsumeAsync(queue: QueueName, autoAck: false, consumer: consumer, cancellationToken: stoppingToken);

                Logger.LogInformation("Started listening to queue {QueueName}...", QueueName);

                var shutdownTcs = new TaskCompletionSource<bool>();
                using var reg = stoppingToken.Register(() => shutdownTcs.TrySetResult(true));

                _channel.ChannelShutdownAsync += (sender, args) =>
                {
                    Logger.LogWarning("Channel for queue {QueueName} shut down: {Reason}", QueueName, args.ReplyText);
                    shutdownTcs.TrySetResult(true);
                    return Task.CompletedTask;
                };

                await shutdownTcs.Task;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                Logger.LogWarning(ex, "Failed to connect or maintain RabbitMQ Consumer for queue {QueueName}. Retrying in 5 seconds...", QueueName);
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
    }

    internal async Task HandleDeliveryAsync(
        byte[] body,
        string? basicPropertiesMessageId,
        ulong deliveryTag,
        Func<ulong, bool, CancellationToken, ValueTask> basicAckAsync,
        Func<ulong, bool, bool, CancellationToken, ValueTask> basicNackAsync,
        CancellationToken cancellationToken)
    {
        var messageString = Encoding.UTF8.GetString(body);
        string? messageId = null;
        string eventType = typeof(TMessage).Name;

        try
        {
            var message = JsonSerializer.Deserialize<TMessage>(messageString, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (message == null)
            {
                Logger.LogWarning("Deserialized null message from queue {QueueName}, acknowledging and dropping.", QueueName);
                await basicAckAsync(deliveryTag, false, cancellationToken);
                return;
            }

            // Extract message ID and event type
            if (message is IEventEnvelope envelope)
            {
                messageId = envelope.EventId.ToString();
                eventType = string.IsNullOrWhiteSpace(envelope.EventType) ? eventType : envelope.EventType;
            }
            else if (!string.IsNullOrWhiteSpace(basicPropertiesMessageId))
            {
                messageId = basicPropertiesMessageId;
            }
            else
            {
                using var sha = SHA256.Create();
                messageId = Convert.ToHexString(sha.ComputeHash(body));
            }

            // Inbox Check: atomic acquisition
            using var scope = ScopeFactory.CreateScope();
            var inboxRepository = scope.ServiceProvider.GetRequiredService<IInboxRepository>();

            var acquired = await inboxRepository.TryAcquireAsync(messageId, QueueName, eventType, cancellationToken);
            if (!acquired)
            {
                Logger.LogInformation("[Inbox] Message {MessageId} for consumer {QueueName} already processed or in-flight. Skipping duplicate.", messageId, QueueName);
                await basicAckAsync(deliveryTag, false, cancellationToken);
                return;
            }

            try
            {
                await ProcessMessageAsync(message, cancellationToken);
                await inboxRepository.MarkProcessedAsync(messageId, QueueName, cancellationToken);
                await basicAckAsync(deliveryTag, false, cancellationToken);
            }
            catch (Exception procEx)
            {
                Logger.LogError(procEx, "[Inbox] Error processing message {MessageId} from queue {QueueName}", messageId, QueueName);
                await inboxRepository.MarkFailedAsync(messageId, QueueName, procEx.Message, cancellationToken);
                await basicNackAsync(deliveryTag, false, false, cancellationToken);
            }
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Error processing or deserializing message from queue {QueueName}", QueueName);
            await basicNackAsync(deliveryTag, false, false, cancellationToken);
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
