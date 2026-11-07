using System;
using System.Threading;
using System.Threading.Tasks;
using MassTransit;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Infrastructure.BackgroundJobs;

/// <summary>
/// Background worker that periodically scans for abandoned payment slots in CREATED status
/// older than the configured timeout window (default 15 minutes).
/// Uses atomic database row claims (ExecuteUpdateAsync) to safely coordinate across
/// multiple horizontal replicas without publishing duplicate expiration messages.
/// </summary>
public class PaymentSlotExpirationWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PaymentSlotExpirationWorker> _logger;
    private readonly TimeSpan _checkInterval;
    private readonly TimeSpan _slotTimeout;

    public PaymentSlotExpirationWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<PaymentSlotExpirationWorker> logger,
        IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        
        var intervalSeconds = configuration.GetValue("Payment:ExpirationCheckIntervalSeconds", 60);
        var timeoutMinutes = configuration.GetValue("Payment:SlotTimeoutMinutes", 15);

        _checkInterval = TimeSpan.FromSeconds(Math.Max(5, intervalSeconds));
        _slotTimeout = TimeSpan.FromMinutes(Math.Max(1, timeoutMinutes));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "PaymentSlotExpirationWorker started with interval {Interval} and timeout {Timeout}",
            _checkInterval, _slotTimeout);

        using var timer = new PeriodicTimer(_checkInterval);

        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await ProcessExpiredSlotsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Graceful shutdown requested
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error occurred during expired slot processing cycle");
            }
        }

        _logger.LogInformation("PaymentSlotExpirationWorker stopping");
    }

    public async Task<int> ProcessExpiredSlotsAsync(CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IPaymentRepository>();
        var publishEndpoint = scope.ServiceProvider.GetRequiredService<IPublishEndpoint>();

        var cutoff = DateTime.UtcNow.Subtract(_slotTimeout);
        var claimedSlots = await repository.ClaimExpiredPaymentsAsync(cutoff, 50, cancellationToken);

        if (claimedSlots.Count > 0)
        {
            _logger.LogInformation(
                "PaymentSlotExpirationWorker claimed {Count} expired payment slot(s)",
                claimedSlots.Count);

            foreach (var (paymentId, sagaId) in claimedSlots)
            {
                _logger.LogInformation(
                    "Publishing PaymentSlotExpired for PaymentId {PaymentId}, SagaId {SagaId}",
                    paymentId, sagaId);

                await publishEndpoint.Publish(new PaymentSlotExpired
                {
                    CorrelationId = sagaId
                }, cancellationToken);
            }
        }

        return claimedSlots.Count;
    }
}
