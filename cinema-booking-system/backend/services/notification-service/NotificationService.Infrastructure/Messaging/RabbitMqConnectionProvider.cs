using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace NotificationService.Infrastructure.Messaging;

public class RabbitMqConnectionProvider : IRabbitMqConnectionProvider, IDisposable, IAsyncDisposable
{
    private readonly RabbitMqSettings _settings;
    private readonly ILogger<RabbitMqConnectionProvider> _logger;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private IConnection? _connection;

    public RabbitMqConnectionProvider(IOptions<RabbitMqSettings> settings, ILogger<RabbitMqConnectionProvider> logger)
    {
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<IConnection> GetConnectionAsync(CancellationToken cancellationToken = default)
    {
        if (_connection is not null && _connection.IsOpen)
        {
            return _connection;
        }

        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            if (_connection is not null && _connection.IsOpen)
            {
                return _connection;
            }

            _logger.LogInformation("Creating new RabbitMQ connection to {HostName}:{Port}", _settings.HostName, _settings.Port);
            
            var factory = new ConnectionFactory
            {
                HostName = _settings.HostName,
                Port = _settings.Port,
                UserName = _settings.UserName,
                Password = _settings.Password
            };

            _connection = await factory.CreateConnectionAsync(cancellationToken);
            return _connection;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create RabbitMQ connection");
            throw;
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public void Dispose()
    {
        _connection?.Dispose();
        _semaphore.Dispose();
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection is not null)
        {
            await _connection.CloseAsync();
            _connection.Dispose();
        }
        _semaphore.Dispose();
    }
}
