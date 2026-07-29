using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using RabbitMQ.Client;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Infrastructure.Messaging;

public class RabbitMQConnectionProvider : IRabbitMQConnectionProvider, IAsyncDisposable
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<RabbitMQConnectionProvider> _logger;
    private IConnection? _connection;
    private readonly SemaphoreSlim _semaphore = new(1, 1);

    public RabbitMQConnectionProvider(IConfiguration configuration, ILogger<RabbitMQConnectionProvider> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<IConnection> GetConnectionAsync(CancellationToken cancellationToken = default)
    {
        if (_connection != null && _connection.IsOpen)
        {
            return _connection;
        }

        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            // Double-check after acquiring the lock
            if (_connection != null && _connection.IsOpen)
            {
                return _connection;
            }

            var hostName = _configuration["RabbitMQ:HostName"] ?? "localhost";
            var userName = _configuration["RabbitMQ:UserName"] ?? "guest";
            var password = _configuration["RabbitMQ:Password"] ?? "guest";

            var factory = new ConnectionFactory
            {
                HostName = hostName,
                UserName = userName,
                Password = password
            };

            int maxRetries = 10;
            int currentRetry = 0;

            while (currentRetry < maxRetries && !cancellationToken.IsCancellationRequested)
            {
                try
                {
                    _connection = await factory.CreateConnectionAsync(cancellationToken);
                    _logger.LogInformation("Successfully connected to RabbitMQ on {HostName}", hostName);
                    return _connection;
                }
                catch (Exception ex)
                {
                    currentRetry++;
                    _logger.LogWarning(ex, "Could not connect to RabbitMQ broker. Retrying {CurrentRetry}/{MaxRetries} in 5 seconds...", currentRetry, maxRetries);

                    if (currentRetry >= maxRetries)
                    {
                        _logger.LogError("Failed to connect to RabbitMQ after {MaxRetries} attempts.", maxRetries);
                        throw;
                    }

                    try
                    {
                        await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                }
            }
            throw new OperationCanceledException("Cancellation requested before connection could be established.");
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection != null)
        {
            await _connection.CloseAsync();
        }
        _semaphore.Dispose();
    }
}
