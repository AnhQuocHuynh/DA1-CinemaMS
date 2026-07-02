using System.Text;
using System.Text.Json;
using FacilityService.Application.Contracts;
using RabbitMQ.Client;

namespace FacilityService.Infrastructure.Messaging;

/// <summary>
/// It implements the IEventPublisher interface defined in the APPLICATION layer.
/// </summary>
public class RabbitMqEventPublisher : IEventPublisher, IDisposable
{
    private readonly IConnection _connection;
    private readonly IChannel _channel;

    // We inject configuration (like RabbitMQ host, username, password) here, 
    // but for simplicity we establish the connection in the constructor.
    // In a production app, use Dependency Injection (IConfiguration) to get the HostName.
    public RabbitMqEventPublisher()
    {
        // 1. Create a Connection Factory. 
        var factory = new ConnectionFactory { HostName = "localhost" };
        
        // 2. Create Connection and Channel
        _connection = factory.CreateConnection();
        _channel = _connection.CreateModel();
    }

    public Task PublishAsync(string topic, string routingKey, string message)
    {
        // 3. Ensure the Exchange exists. 
        // 'Topic' exchange routes messages to queues based on the routingKey pattern (e.g., 'facility.*')
        _channel.ExchangeDeclare(exchange: topic, type: ExchangeType.Topic, durable: true);

        // 4. Convert the string message to a byte array (RabbitMQ only speaks bytes)
        var body = Encoding.UTF8.GetBytes(message);

        // 5. Publish the message!
        // Note: In older RabbitMQ clients, BasicPublish is synchronous. 
        // If you are using RabbitMQ.Client v7+, there is a BasicPublishAsync method.
        _channel.BasicPublish(
            exchange: topic,
            routingKey: routingKey,
            basicProperties: null,
            body: body);

        // Returning a completed task because the interface expects a Task
        return Task.CompletedTask; 
    }

    public Task PublishAsync<T>(string topic, string routingKey, T message) where T : class
    {
        // 1. Serialize our C# object to JSON format
        var jsonMessage = JsonSerializer.Serialize(message);

        // 2. Reuse the string publishing method above
        return PublishAsync(topic, routingKey, jsonMessage);
    }

    // Clean up resources when the application shuts down
    public void Dispose()
    {
        _channel?.Dispose();
        _connection?.Dispose();
    }
}
