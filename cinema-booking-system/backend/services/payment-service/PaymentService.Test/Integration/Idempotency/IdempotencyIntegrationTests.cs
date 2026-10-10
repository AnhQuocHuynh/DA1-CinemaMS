using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Infrastructure.Data;
using PaymentService.Infrastructure.Sagas;
using PaymentService.Presentation.Controllers;
using Xunit;
using Xunit.Abstractions;

namespace PaymentService.Test.Integration.Idempotency;

/// <summary>
/// Integration tests verifying idempotency guarantees across the full stack:
/// HTTP controllers, EF Core persistence, MassTransit saga, and PostgreSQL unique constraints.
/// Requires Docker (Testcontainers spins up PostgreSQL + RabbitMQ).
/// </summary>
[Collection("Integration Tests")]
public class IdempotencyIntegrationTests : IClassFixture<CustomWebApplicationFactory>, IAsyncLifetime
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly IServiceScope _scope;
    private readonly IBus _bus;
    private readonly PaymentDbContext _dbContext;
    private readonly ITestOutputHelper _output;

    public IdempotencyIntegrationTests(CustomWebApplicationFactory factory, ITestOutputHelper output)
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
        _dbContext.Payments.RemoveRange(_dbContext.Payments);
        _dbContext.Set<PaymentSagaState>().RemoveRange(_dbContext.Set<PaymentSagaState>());
        await _dbContext.SaveChangesAsync();

        _scope.Dispose();
    }

    private async Task WaitForSagaState(Guid correlationId, string expectedState, TimeSpan timeout)
    {
        var startTime = DateTime.UtcNow;
        while (DateTime.UtcNow - startTime < timeout)
        {
            var saga = await _dbContext.Set<PaymentSagaState>()
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.CorrelationId == correlationId);

            if (saga != null && saga.CurrentState == expectedState)
            {
                _output.WriteLine($"Saga {correlationId} reached state '{expectedState}'");
                return;
            }

            _output.WriteLine($"Saga {correlationId}: current state = '{saga?.CurrentState ?? "not found"}', waiting for '{expectedState}'...");
            await Task.Delay(500);
        }

        throw new TimeoutException(
            $"Saga {correlationId} did not reach state '{expectedState}' within {timeout}");
    }

    // ── Test 1: HTTP-level — Duplicate order initiation ──────────────────────

    [Fact]
    public async Task InitiatePayment_DuplicateOrderId_ShouldReturnConflict()
    {
        // Arrange — seed a PENDING payment for orderId 7001
        var existingPayment = new Payment(7001, 42, 150000m, "VND", PaymentMethod.CASH);
        _dbContext.Payments.Add(existingPayment);
        await _dbContext.SaveChangesAsync();

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", "Test 42:user");

        var request = new InitiatePaymentRequest(
            OrderId: 7001,
            Amount: 150000m,
            PaymentMethod: PaymentMethod.CASH
        );

        // Act — attempt to initiate payment for the same order
        var response = await client.PostAsJsonAsync("/api/payments/initiate", request);

        // Assert — should be 409 Conflict (InvalidPaymentStateException)
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);

        // Verify only one payment exists for this order
        var paymentCount = await _dbContext.Payments
            .AsNoTracking()
            .CountAsync(p => p.OrderId == 7001);
        paymentCount.Should().Be(1, "duplicate order should not create a second payment");
    }

    // ── Test 2: Saga-level — Duplicate PaymentInitiated messages ─────────────

    [Fact]
    public async Task DuplicatePaymentInitiated_ShouldCreateSingleSagaInstance()
    {
        // Arrange — create payment in DB (saga needs a matching payment)
        var payment = new Payment(7002, 42, 100000m, "VND", PaymentMethod.STRIPE);
        _dbContext.Payments.Add(payment);
        await _dbContext.SaveChangesAsync();

        var correlationId = payment.SagaId;

        var initiated = new PaymentInitiated
        {
            CorrelationId = correlationId,
            PaymentId = payment.Id,
            OrderId = payment.OrderId,
            UserId = payment.UserId,
            Amount = payment.Amount,
            Currency = payment.Currency,
            PaymentMethod = payment.PaymentMethod.ToString()
        };

        // Act — publish PaymentInitiated twice with the same CorrelationId
        await _bus.Publish(initiated);
        await _bus.Publish(initiated);

        // Wait for saga to reach Pending
        await WaitForSagaState(correlationId, "Pending", TimeSpan.FromSeconds(10));

        // Assert — only one saga instance exists for this CorrelationId
        var sagaInstances = await _dbContext.Set<PaymentSagaState>()
            .AsNoTracking()
            .Where(s => s.CorrelationId == correlationId)
            .ToListAsync();

        sagaInstances.Should().ContainSingle(
            "duplicate PaymentInitiated should not create a second saga instance");
        sagaInstances[0].CurrentState.Should().Be("Pending");
    }

    // ── Test 3: Saga-level — Duplicate gateway callback on completed payment ─

    [Fact]
    public async Task DuplicateGatewayCallback_ShouldNotDuplicateCompletedState()
    {
        // Arrange — create payment and seed saga in Pending state
        var payment = new Payment(7003, 42, 200000m, "VND", PaymentMethod.STRIPE);
        _dbContext.Payments.Add(payment);
        await _dbContext.SaveChangesAsync();

        var correlationId = payment.SagaId;

        // Initiate the saga to get it to Pending
        await _bus.Publish(new PaymentInitiated
        {
            CorrelationId = correlationId,
            PaymentId = payment.Id,
            OrderId = payment.OrderId,
            UserId = payment.UserId,
            Amount = payment.Amount,
            Currency = payment.Currency,
            PaymentMethod = payment.PaymentMethod.ToString()
        });

        await WaitForSagaState(correlationId, "Pending", TimeSpan.FromSeconds(10));

        var callback = new GatewayCallbackReceived
        {
            CorrelationId = correlationId,
            IsSuccess = true,
            TransactionId = "txn_idempotent_test",
            RawResponse = "{ \"status\": \"succeeded\" }"
        };

        // Act — publish the same callback twice
        await _bus.Publish(callback);
        await WaitForSagaState(correlationId, "Completed", TimeSpan.FromSeconds(10));

        await _bus.Publish(callback);
        await Task.Delay(2000); // Allow time for second message to be processed

        // Assert — saga still in Completed (not errored or duplicated)
        var sagaInstances = await _dbContext.Set<PaymentSagaState>()
            .AsNoTracking()
            .Where(s => s.CorrelationId == correlationId)
            .ToListAsync();

        sagaInstances.Should().ContainSingle("no duplicate saga rows should exist");
        sagaInstances[0].CurrentState.Should().Be("Completed",
            "saga should remain in Completed state after duplicate callback");

        // Payment entity should still be COMPLETED with original transaction ID
        var updatedPayment = await _dbContext.Payments
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == payment.Id);

        updatedPayment.Should().NotBeNull();
        updatedPayment!.Status.Should().Be(PaymentStatus.COMPLETED);
        updatedPayment.TransactionId.Should().Be("txn_idempotent_test",
            "original transaction ID should be preserved");
    }

    // ── Test 4: HTTP-level — Cash confirm twice ──────────────────────────────

    [Fact]
    public async Task ConfirmCashPayment_Twice_ShouldBeIdempotent()
    {
        // Arrange — create a CASH payment in PENDING status and seed its saga
        var payment = new Payment(7004, 42, 80000m, "VND", PaymentMethod.CASH);
        _dbContext.Payments.Add(payment);
        await _dbContext.SaveChangesAsync();

        var correlationId = payment.SagaId;

        // Initiate the saga
        await _bus.Publish(new PaymentInitiated
        {
            CorrelationId = correlationId,
            PaymentId = payment.Id,
            OrderId = payment.OrderId,
            UserId = payment.UserId,
            Amount = payment.Amount,
            Currency = payment.Currency,
            PaymentMethod = payment.PaymentMethod.ToString()
        });

        await WaitForSagaState(correlationId, "Pending", TimeSpan.FromSeconds(10));

        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", "Test 999:ADMIN");

        var confirmRequest = new ConfirmCashRequest(payment.Id);

        // Act — confirm cash payment the first time
        var firstResponse = await client.PostAsJsonAsync("/api/payments/cash/confirm", confirmRequest);

        // Wait for saga to reach Completed
        await WaitForSagaState(correlationId, "Completed", TimeSpan.FromSeconds(10));

        // Act — confirm cash payment the second time (should be idempotent)
        var secondClient = _factory.CreateClient();
        secondClient.DefaultRequestHeaders.Add("Authorization", "Test 999:ADMIN");
        var secondResponse = await secondClient.PostAsJsonAsync("/api/payments/cash/confirm", confirmRequest);

        // Assert — both responses should be successful (200 OK)
        firstResponse.StatusCode.Should().Be(HttpStatusCode.OK,
            "first cash confirmation should succeed");
        secondResponse.StatusCode.Should().Be(HttpStatusCode.OK,
            "second cash confirmation should be idempotent and still return 200");

        // Payment should be COMPLETED
        var updatedPayment = await _dbContext.Payments
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == payment.Id);

        updatedPayment.Should().NotBeNull();
        updatedPayment!.Status.Should().Be(PaymentStatus.COMPLETED);
    }

    // ── Test 5: Saga-level — Duplicate refund request ────────────────────────

    [Fact]
    public async Task DuplicateRefundRequested_ShouldNotCreateDoubleRefund()
    {
        // Arrange — create a completed payment and seed its saga in Completed state
        var payment = new Payment(7005, 42, 120000m, "VND", PaymentMethod.STRIPE);
        payment.Complete("txn_refund_test", "{}");
        _dbContext.Payments.Add(payment);
        await _dbContext.SaveChangesAsync();

        var correlationId = payment.SagaId;

        // Seed saga directly in Completed state (matches Flow4 pattern)
        var saga = new PaymentSagaState
        {
            CorrelationId = correlationId,
            CurrentState = "Completed",
            PaymentId = payment.Id,
            OrderId = payment.OrderId,
            UserId = payment.UserId,
            Amount = payment.Amount,
            Currency = payment.Currency,
            PaymentMethod = payment.PaymentMethod.ToString(),
            TransactionId = "txn_refund_test",
            CreatedAt = DateTime.UtcNow,
            CompletedAt = DateTime.UtcNow
        };
        _dbContext.Set<PaymentSagaState>().Add(saga);
        await _dbContext.SaveChangesAsync();

        var refundRequest = new RefundRequested
        {
            CorrelationId = correlationId,
            PaymentId = payment.Id,
            Amount = 120000m,
            Reason = "Duplicate refund idempotency test"
        };

        // Act — publish the same RefundRequested twice
        await _bus.Publish(refundRequest);
        await WaitForSagaState(correlationId, "Refunded", TimeSpan.FromSeconds(10));

        await _bus.Publish(refundRequest);
        await Task.Delay(2000); // Allow time for second message to be processed

        // Assert — saga is in Refunded state (not errored)
        var sagaState = await _dbContext.Set<PaymentSagaState>()
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.CorrelationId == correlationId);

        sagaState.Should().NotBeNull();
        sagaState!.CurrentState.Should().Be("Refunded",
            "saga should remain in Refunded state after duplicate refund request");

        // Only one refund record should exist on the payment
        var updatedPayment = await _dbContext.Payments
            .Include(p => p.Refunds)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == payment.Id);

        updatedPayment.Should().NotBeNull();
        updatedPayment!.Refunds.Should().ContainSingle(
            "duplicate RefundRequested should not create a second refund record");
        updatedPayment.Refunds.First().Amount.Should().Be(120000m);
    }
}
