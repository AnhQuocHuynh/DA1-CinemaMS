using MassTransit;
using MassTransit.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Infrastructure.Data;
using PaymentService.Infrastructure.Sagas;
using Xunit;
using Xunit.Abstractions;

namespace PaymentService.Test.Integration.Sagas;

[Collection("Integration Tests")]
public class PaymentStateMachineIntegrationTests : IAsyncLifetime
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly IServiceScope _scope;
    private readonly IBus _bus;
    private readonly PaymentDbContext _dbContext;
    private readonly ITestOutputHelper _output;

    public PaymentStateMachineIntegrationTests(CustomWebApplicationFactory factory, ITestOutputHelper output)
    {
        _factory = factory;
        _output = output;
        _factory.OutputHelper = output;
        
        _scope = _factory.Services.CreateScope();
        _bus = _scope.ServiceProvider.GetRequiredService<IBus>();
        _dbContext = _scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        // Clean up database after each test
        _dbContext.Refunds.RemoveRange(_dbContext.Refunds);
        _dbContext.TransactionLogs.RemoveRange(_dbContext.TransactionLogs);
        _dbContext.Payments.RemoveRange(_dbContext.Payments);
        _dbContext.Set<PaymentSagaState>().RemoveRange(_dbContext.Set<PaymentSagaState>());
        await _dbContext.SaveChangesAsync();
        
        _scope.Dispose();
    }

    private async Task WaitForSagaState(Guid correlationId, string expectedState, TimeSpan? timeout = null)
    {
        var effectiveTimeout = timeout.HasValue && timeout.Value > TimeSpan.FromSeconds(15)
            ? timeout.Value
            : TimeSpan.FromSeconds(15);
        var startTime = DateTime.UtcNow;
        while (DateTime.UtcNow - startTime < effectiveTimeout)
        {
            var allSagas = await _dbContext.Set<PaymentSagaState>().AsNoTracking().ToListAsync();
            _output.WriteLine($"Current Sagas in DB: {allSagas.Count}. Looking for: {correlationId}");
            foreach(var s in allSagas) 
            {
                _output.WriteLine($"- ID: {s.CorrelationId}, State: {s.CurrentState}");
            }

            var saga = allSagas.FirstOrDefault(s => s.CorrelationId == correlationId);
                
            if (saga != null && saga.CurrentState == expectedState)
                return;
                
            await Task.Delay(1000);
        }
        throw new TimeoutException($"Saga {correlationId} did not reach state {expectedState} within {effectiveTimeout}");
    }

    [Fact]
    public async Task Flow1_GatewaySuccess_ShouldCompletePayment()
    {
        // Pre-create the payment in pending state
        var payment = new Payment(1001, 2001, 100m, "USD", PaymentMethod.STRIPE);
        _dbContext.Payments.Add(payment);
        await _dbContext.SaveChangesAsync();
        
        var correlationId = payment.SagaId;
        var paymentId = payment.Id;

        // Act 1: Initiate Payment
        await _bus.Publish(new PaymentInitiated
        {
            CorrelationId = correlationId,
            PaymentId = paymentId,
            OrderId = payment.OrderId,
            UserId = payment.UserId,
            Amount = payment.Amount,
            Currency = payment.Currency,
            PaymentMethod = payment.PaymentMethod.ToString()
        });

        // Assert 1: Saga goes to Pending
        await WaitForSagaState(correlationId, "Pending", TimeSpan.FromSeconds(10));

        // Act 2: Gateway Success Callback
        await _bus.Publish(new GatewayCallbackReceived
        {
            CorrelationId = correlationId,
            IsSuccess = true,
            TransactionId = "txn_stripe_123",
            RawResponse = "{ \"status\": \"succeeded\" }"
        });

        // Assert 2: Saga goes to Completed
        await WaitForSagaState(correlationId, "Completed", TimeSpan.FromSeconds(10));

        // Assert 3: Payment entity updated
        var updatedPayment = await _dbContext.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.Id == paymentId);
        Assert.NotNull(updatedPayment);
        Assert.Equal(PaymentStatus.COMPLETED, updatedPayment.Status);
        Assert.Equal("txn_stripe_123", updatedPayment.TransactionId);
    }

    [Fact]
    public async Task Flow2_GatewayFailure_ShouldFailPayment()
    {
        // Arrange
        var payment = new Payment(1002, 2002, 100m, "USD", PaymentMethod.STRIPE);
        _dbContext.Payments.Add(payment);
        await _dbContext.SaveChangesAsync();

        var correlationId = payment.SagaId;
        var paymentId = payment.Id;

        // Act 1: Initiate Payment
        await _bus.Publish(new PaymentInitiated
        {
            CorrelationId = correlationId,
            PaymentId = paymentId,
            OrderId = payment.OrderId,
            UserId = payment.UserId,
            Amount = payment.Amount,
            Currency = payment.Currency,
            PaymentMethod = payment.PaymentMethod.ToString()
        });

        await WaitForSagaState(correlationId, "Pending", TimeSpan.FromSeconds(10));

        // Act 2: Gateway Failure Callback
        await _bus.Publish(new GatewayCallbackReceived
        {
            CorrelationId = correlationId,
            IsSuccess = false,
            ErrorMessage = "Insufficient funds",
            RawResponse = "{ \"status\": \"failed\" }"
        });

        // Assert 2: Saga goes to Failed
        await WaitForSagaState(correlationId, "Failed", TimeSpan.FromSeconds(10));

        // Assert 3: Payment entity updated
        var updatedPayment = await _dbContext.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.Id == paymentId);
        Assert.NotNull(updatedPayment);
        Assert.Equal(PaymentStatus.FAILED, updatedPayment.Status);
    }

    [Fact]
    public async Task Flow3_CashPayment_ShouldCompletePayment()
    {
        // Arrange
        var payment = new Payment(1003, 2003, 100m, "VND", PaymentMethod.CASH);
        _dbContext.Payments.Add(payment);
        await _dbContext.SaveChangesAsync();

        var correlationId = payment.SagaId;
        var paymentId = payment.Id;

        // Act 1: Initiate Payment (CASH immediately transitions to Completed)
        await _bus.Publish(new PaymentInitiated
        {
            CorrelationId = correlationId,
            PaymentId = paymentId,
            OrderId = payment.OrderId,
            UserId = payment.UserId,
            Amount = payment.Amount,
            Currency = payment.Currency,
            PaymentMethod = payment.PaymentMethod.ToString()
        });

        // Assert 1: Saga goes directly to Completed for CASH
        await WaitForSagaState(correlationId, "Completed", TimeSpan.FromSeconds(10));

        // Assert 2: Payment entity updated
        var updatedPayment = await _dbContext.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.Id == paymentId);
        Assert.NotNull(updatedPayment);
        Assert.Equal(PaymentStatus.COMPLETED, updatedPayment.Status);
        Assert.StartsWith("CASH-", updatedPayment.TransactionId);
    }

    [Fact]
    public async Task Flow4_Refund_ShouldTransitionToRefunded()
    {
        // Arrange
        var payment = new Payment(1004, 2004, 100m, "USD", PaymentMethod.STRIPE);
        // Force complete state for refund
        payment.Complete("txn_stripe_123", "{}");
        _dbContext.Payments.Add(payment);
        await _dbContext.SaveChangesAsync();
        
        var correlationId = payment.SagaId;
        var paymentId = payment.Id;
        
        // Seed saga in Completed state
        var saga = new PaymentSagaState
        {
            CorrelationId = correlationId,
            CurrentState = "Completed",
            PaymentId = paymentId,
            OrderId = payment.OrderId,
            UserId = payment.UserId,
            Amount = payment.Amount,
            Currency = payment.Currency,
            PaymentMethod = payment.PaymentMethod.ToString(),
            TransactionId = "txn_stripe_123",
            CreatedAt = DateTime.UtcNow,
            CompletedAt = DateTime.UtcNow
        };
        _dbContext.Set<PaymentSagaState>().Add(saga);
        await _dbContext.SaveChangesAsync();

        // Act: Request Refund
        await _bus.Publish(new RefundRequested
        {
            CorrelationId = correlationId,
            Amount = 100m,
            Reason = "Customer request"
        });

        // Assert: Saga goes to Refunded
        await WaitForSagaState(correlationId, "Refunded", TimeSpan.FromSeconds(10));

        // Assert: Payment entity has refund record
        var updatedPayment = await _dbContext.Payments.Include(p => p.Refunds).AsNoTracking().FirstOrDefaultAsync(p => p.Id == paymentId);
        Assert.NotNull(updatedPayment);
        Assert.Single(updatedPayment.Refunds);
        Assert.Equal(100m, updatedPayment.Refunds.First().Amount);
    }

    [Fact]
    public async Task Flow5_OrderSlotReserved_ShouldTransitionToCreated_AndThenPaymentInitiated_ShouldTransitionToPending()
    {
        // Arrange — pre-reserve CREATED payment
        var payment = new Payment(1005, 2005, 120000m, "VND");
        _dbContext.Payments.Add(payment);
        await _dbContext.SaveChangesAsync();

        var correlationId = payment.SagaId;
        var paymentId = payment.Id;

        // Act 1: Reserve slot (published after order.created)
        await _bus.Publish(new OrderSlotReserved
        {
            CorrelationId = correlationId,
            PaymentId = paymentId,
            OrderId = payment.OrderId,
            UserId = payment.UserId,
            Amount = payment.Amount,
            Currency = payment.Currency
        });

        // Assert 1: Saga goes to Created state
        await WaitForSagaState(correlationId, "Created", TimeSpan.FromSeconds(10));

        var createdSaga = await _dbContext.Set<PaymentSagaState>()
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.CorrelationId == correlationId);
        Assert.NotNull(createdSaga);
        Assert.Equal(paymentId, createdSaga.PaymentId);
        Assert.Equal(120000m, createdSaga.Amount);
        Assert.Equal("VND", createdSaga.Currency);

        // Act 2: Customer clicks pay / initiates payment
        await _bus.Publish(new PaymentInitiated
        {
            CorrelationId = correlationId,
            PaymentId = paymentId,
            OrderId = payment.OrderId,
            UserId = payment.UserId,
            Amount = payment.Amount,
            Currency = payment.Currency,
            PaymentMethod = PaymentMethod.STRIPE.ToString()
        });

        // Assert 2: Saga transitions from Created to Pending
        await WaitForSagaState(correlationId, "Pending", TimeSpan.FromSeconds(10));
    }

    [Fact]
    public async Task Flow6_SlotExpired_ShouldExpirePayment()
    {
        // Arrange — pre-reserve CREATED payment
        var payment = new Payment(1006, 2006, 150000m, "VND");
        _dbContext.Payments.Add(payment);
        await _dbContext.SaveChangesAsync();

        var correlationId = payment.SagaId;
        var paymentId = payment.Id;

        // Act 1: Reserve slot
        await _bus.Publish(new OrderSlotReserved
        {
            CorrelationId = correlationId,
            PaymentId = paymentId,
            OrderId = payment.OrderId,
            UserId = payment.UserId,
            Amount = payment.Amount,
            Currency = payment.Currency
        });

        await WaitForSagaState(correlationId, "Created", TimeSpan.FromSeconds(10));

        // Act 2: Simulate expiry event (fired when 15-minute schedule elapses)
        await _bus.Publish(new PaymentSlotExpired
        {
            CorrelationId = correlationId
        });

        // Assert: Payment entity in DB should transition to EXPIRED
        var startTime = DateTime.UtcNow;
        Payment? updatedPayment = null;
        while (DateTime.UtcNow - startTime < TimeSpan.FromSeconds(10))
        {
            updatedPayment = await _dbContext.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.Id == paymentId);
            if (updatedPayment?.Status == PaymentStatus.EXPIRED)
                break;
            await Task.Delay(500);
        }

        Assert.NotNull(updatedPayment);
        Assert.Equal(PaymentStatus.EXPIRED, updatedPayment.Status);
    }
}
