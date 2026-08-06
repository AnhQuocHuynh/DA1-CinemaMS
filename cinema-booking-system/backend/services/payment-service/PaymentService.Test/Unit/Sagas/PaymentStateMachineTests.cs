using MassTransit;
using MassTransit.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Infrastructure.Sagas;

namespace PaymentService.Test.Unit.Sagas;

/// <summary>
/// Unit tests for PaymentStateMachine using MassTransit's in-memory test harness.
/// 
/// The harness runs the full state machine in-process with no external dependencies,
/// verifying state transitions and published events without RabbitMQ or PostgreSQL.
/// </summary>
public class PaymentStateMachineTests : IAsyncLifetime
{
    private readonly ITestHarness _harness;
    private readonly ISagaStateMachineTestHarness<PaymentStateMachine, PaymentSagaState> _sagaHarness;

    public PaymentStateMachineTests()
    {
        var services = new ServiceCollection();

        services.AddMassTransitTestHarness(x =>
        {
            x.AddSagaStateMachine<PaymentStateMachine, PaymentSagaState>()
                .InMemoryRepository();
        });

        services.AddSingleton(typeof(ILogger<>), typeof(NullLogger<>));

        var provider = services.BuildServiceProvider();

        _harness = provider.GetRequiredService<ITestHarness>();
        _sagaHarness = _harness.GetSagaStateMachineHarness<PaymentStateMachine, PaymentSagaState>();
    }

    public async Task InitializeAsync() => await _harness.Start();

    public async Task DisposeAsync() => await _harness.Stop();

    private static Guid NewCorrelation() => Guid.NewGuid();

    // ── Initial → Pending ─────────────────────────────────────────────────────

    [Fact]
    public async Task PaymentInitiated_ShouldTransitionSagaToPending()
    {
        // Arrange
        var correlationId = NewCorrelation();

        // Act
        await _harness.Bus.Publish(new PaymentInitiated
        {
            CorrelationId = correlationId,
            PaymentId = 1001,
            OrderId = 2001,
            UserId = 42,
            Amount = 180000m,
            Currency = "VND",
            PaymentMethod = "STRIPE"
        });

        // Assert — saga instance exists and is in Pending state
        await AssertSagaInState(correlationId, "Pending");
    }

    // ── Pending → Completed (success callback) ────────────────────────────────

    [Fact]
    public async Task GatewayCallbackSucceeded_ShouldTransitionToCompleted_AndPublishPaymentCompleted()
    {
        // Arrange
        var correlationId = NewCorrelation();

        await _harness.Bus.Publish(new PaymentInitiated
        {
            CorrelationId = correlationId,
            PaymentId = 1002,
            OrderId = 2002,
            UserId = 42,
            Amount = 90000m,
            Currency = "VND",
            PaymentMethod = "STRIPE"
        });

        await Task.Delay(50); // Allow saga to process PaymentInitiated

        // Act
        await _harness.Bus.Publish(new GatewayCallbackReceived
        {
            CorrelationId = correlationId,
            PaymentMethod = "STRIPE",
            IsSuccess = true,
            TransactionId = "pi_test123",
            RawResponse = "{}"
        });

        // Assert — state = Completed
        await AssertSagaInState(correlationId, "Completed");

        // Assert — PaymentCompleted was published
        Assert.True(await _harness.Published.Any<PaymentCompleted>(
            m => m.Context.Message.CorrelationId == correlationId &&
                 m.Context.Message.TransactionId == "pi_test123"));
    }

    // ── Pending → Failed (failure callback) ───────────────────────────────────

    [Fact]
    public async Task GatewayCallbackFailed_ShouldTransitionToFailed_AndPublishPaymentFailed()
    {
        // Arrange
        var correlationId = NewCorrelation();

        await _harness.Bus.Publish(new PaymentInitiated
        {
            CorrelationId = correlationId,
            PaymentId = 1003,
            OrderId = 2003,
            UserId = 42,
            Amount = 70000m,
            Currency = "VND",
            PaymentMethod = "PAYPAL"
        });

        await Task.Delay(50);

        // Act
        await _harness.Bus.Publish(new GatewayCallbackReceived
        {
            CorrelationId = correlationId,
            PaymentMethod = "PAYPAL",
            IsSuccess = false,
            ErrorMessage = "insufficient_funds"
        });

        // Assert — state = Failed
        await AssertSagaInState(correlationId, "Failed");

        // Assert — PaymentFailed was published with the correct reason
        Assert.True(await _harness.Published.Any<PaymentFailed>(
            m => m.Context.Message.CorrelationId == correlationId &&
                 m.Context.Message.Reason == "insufficient_funds"));
    }

    // ── Pending → Completed (cash confirmation) ───────────────────────────────

    [Fact]
    public async Task CashPaymentConfirmed_ShouldTransitionToCompleted_AndPublishPaymentCompleted()
    {
        // Arrange
        var correlationId = NewCorrelation();

        await _harness.Bus.Publish(new PaymentInitiated
        {
            CorrelationId = correlationId,
            PaymentId = 1004,
            OrderId = 2004,
            UserId = 42,
            Amount = 60000m,
            Currency = "VND",
            PaymentMethod = "CASH"
        });

        await Task.Delay(50);

        // Act — admin confirms cash collected
        await _harness.Bus.Publish(new CashPaymentConfirmed
        {
            CorrelationId = correlationId,
            PaymentId = 1004,
            AdminUserId = 999
        });

        // Assert — state = Completed
        await AssertSagaInState(correlationId, "Completed");

        // Assert — PaymentCompleted was published
        Assert.True(await _harness.Published.Any<PaymentCompleted>(
            m => m.Context.Message.CorrelationId == correlationId &&
                 m.Context.Message.PaymentMethod == "CASH"));
    }

    // ── Completed → Refunded ──────────────────────────────────────────────────

    [Fact]
    public async Task RefundRequested_WhenCompleted_ShouldTransitionToRefunded_AndPublishPaymentRefunded()
    {
        // Arrange — complete a saga first
        var correlationId = NewCorrelation();

        await _harness.Bus.Publish(new PaymentInitiated
        {
            CorrelationId = correlationId,
            PaymentId = 1005,
            OrderId = 2005,
            UserId = 42,
            Amount = 150000m,
            Currency = "VND",
            PaymentMethod = "STRIPE"
        });
        await Task.Delay(50);

        await _harness.Bus.Publish(new GatewayCallbackReceived
        {
            CorrelationId = correlationId,
            PaymentMethod = "STRIPE",
            IsSuccess = true,
            TransactionId = "pi_refund_test"
        });
        await Task.Delay(50);

        // Act — request refund
        await _harness.Bus.Publish(new RefundRequested
        {
            CorrelationId = correlationId,
            PaymentId = 1005,
            Amount = 150000m,
            Reason = "Customer changed mind"
        });

        // Assert — state = Refunded
        await AssertSagaInState(correlationId, "Refunded");

        // Assert — PaymentRefunded published
        Assert.True(await _harness.Published.Any<PaymentRefunded>(
            m => m.Context.Message.CorrelationId == correlationId &&
                 m.Context.Message.Reason == "Customer changed mind"));
    }

    // ── Duplicate PaymentInitiated — idempotent ───────────────────────────────

    [Fact]
    public async Task DuplicatePaymentInitiated_ShouldNotCreateDuplicateSagaInstances()
    {
        // Arrange
        var correlationId = NewCorrelation();

        var initiated = new PaymentInitiated
        {
            CorrelationId = correlationId,
            PaymentId = 1006,
            OrderId = 2006,
            UserId = 42,
            Amount = 80000m,
            Currency = "VND",
            PaymentMethod = "STRIPE"
        };

        // Act — publish twice
        await _harness.Bus.Publish(initiated);
        await _harness.Bus.Publish(initiated);

        await Task.Delay(100);

        // Assert — only one saga instance exists
        var instances = _sagaHarness.Sagas.Select(s => s.CorrelationId == correlationId).ToList();
        Assert.Single(instances);
    }

    // ── Callback on non-existent saga ─────────────────────────────────────────

    [Fact]
    public async Task GatewayCallback_ForUnknownCorrelationId_ShouldNotPublishEvent()
    {
        // Arrange — use a random CorrelationId that was never initiated
        var unknownCorrelationId = Guid.NewGuid();

        // Act
        await _harness.Bus.Publish(new GatewayCallbackReceived
        {
            CorrelationId = unknownCorrelationId,
            PaymentMethod = "STRIPE",
            IsSuccess = true,
            TransactionId = "pi_orphan"
        });

        await Task.Delay(100);

        // Assert — no PaymentCompleted published for an unknown saga
        Assert.False(await _harness.Published.Any<PaymentCompleted>(
            m => m.Context.Message.CorrelationId == unknownCorrelationId));
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private async Task AssertSagaInState(Guid correlationId, string expectedState, int timeoutMs = 3000)
    {
        var deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
        while (DateTime.UtcNow < deadline)
        {
            // Query the in-memory saga repository directly
            var instances = _sagaHarness.Sagas
                .Select(s => s.CorrelationId == correlationId && s.CurrentState == expectedState)
                .ToList();
            if (instances.Count > 0)
                return;
            await Task.Delay(50);
        }
        Assert.Fail($"Saga {correlationId} did not reach state '{expectedState}' within {timeoutMs}ms.");
    }
}
