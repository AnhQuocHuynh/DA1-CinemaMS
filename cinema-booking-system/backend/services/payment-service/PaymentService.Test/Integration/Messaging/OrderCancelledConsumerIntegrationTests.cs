using System;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PaymentService.Application.Contracts;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Infrastructure.Data;
using PaymentService.Infrastructure.Sagas;
using Xunit;
using Xunit.Abstractions;

namespace PaymentService.Test.Integration.Messaging;

[Collection("Integration Tests")]
public class OrderCancelledConsumerIntegrationTests : IAsyncLifetime
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly IServiceScope _scope;
    private readonly IBus _bus;
    private readonly PaymentDbContext _dbContext;
    private readonly ITestOutputHelper _output;

    public OrderCancelledConsumerIntegrationTests(CustomWebApplicationFactory factory, ITestOutputHelper output)
    {
        _factory = factory;
        _output = output;
        _factory.OutputHelper = output;

        _scope = _factory.Services.CreateScope();
        _bus = _scope.ServiceProvider.GetRequiredService<IBus>();
        _dbContext = _scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
    }

    public async Task InitializeAsync()
    {
        await Task.Delay(1500);
    }

    public async Task DisposeAsync()
    {
        _dbContext.Refunds.RemoveRange(_dbContext.Refunds);
        _dbContext.Payments.RemoveRange(_dbContext.Payments);
        _dbContext.Set<PaymentSagaState>().RemoveRange(_dbContext.Set<PaymentSagaState>());
        await _dbContext.SaveChangesAsync();

        _scope.Dispose();
    }

    private async Task WaitForConditionAsync(Func<Task<bool>> condition, TimeSpan timeout)
    {
        var startTime = DateTime.UtcNow;
        while (DateTime.UtcNow - startTime < timeout)
        {
            if (await condition())
                return;
            await Task.Delay(300);
        }
    }

    [Fact]
    public async Task OrderCancelled_WhenPaymentCompleted_ShouldRefundPayment_AndTransitionSagaToRefunded()
    {
        // Arrange — seed a COMPLETED CASH payment and its Completed Saga state
        const long orderId = 9901;
        const long userId = 42;
        const decimal amount = 160000m;

        var payment = new Payment(orderId, userId, amount, "VND", PaymentMethod.CASH);
        payment.Complete("CASH-9901", "Cash collected at counter");
        _dbContext.Payments.Add(payment);
        await _dbContext.SaveChangesAsync();

        var saga = new PaymentSagaState
        {
            CorrelationId = payment.SagaId,
            CurrentState = "Completed",
            PaymentId = payment.Id,
            OrderId = orderId,
            UserId = userId,
            Amount = amount,
            Currency = "VND",
            PaymentMethod = PaymentMethod.CASH.ToString(),
            TransactionId = "CASH-9901",
            CreatedAt = DateTime.UtcNow,
            CompletedAt = DateTime.UtcNow
        };
        _dbContext.Set<PaymentSagaState>().Add(saga);
        await _dbContext.SaveChangesAsync();

        var envelope = new EventEnvelope<OrderCancelled>
        {
            EventId = Guid.NewGuid(),
            EventType = "order.cancelled",
            OccurredAt = DateTime.UtcNow,
            Source = "booking-service",
            Payload = new OrderCancelled
            {
                OrderId = orderId,
                UserId = userId,
                Reason = "SEATS_UNAVAILABLE_AFTER_PAYMENT"
            }
        };

        // Act — publish order.cancelled to booking.events exchange
        await _bus.Publish(envelope, ctx => ctx.SetRoutingKey("order.cancelled"));

        // Assert 1: Payment entity transitions to REFUNDED with 1 processed Refund record
        Payment? updatedPayment = null;
        await WaitForConditionAsync(async () =>
        {
            updatedPayment = await _dbContext.Payments
                .Include(p => p.Refunds)
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == payment.Id);
            return updatedPayment?.Status == PaymentStatus.REFUNDED;
        }, TimeSpan.FromSeconds(10));

        updatedPayment.Should().NotBeNull();
        updatedPayment!.Status.Should().Be(PaymentStatus.REFUNDED);
        updatedPayment.Refunds.Should().ContainSingle();
        updatedPayment.Refunds.First().Amount.Should().Be(amount);
        updatedPayment.Refunds.First().Reason.Should().Be("SEATS_UNAVAILABLE_AFTER_PAYMENT");

        // Assert 2: Saga transitions from Completed -> Refunded
        PaymentSagaState? updatedSaga = null;
        await WaitForConditionAsync(async () =>
        {
            updatedSaga = await _dbContext.Set<PaymentSagaState>()
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.CorrelationId == payment.SagaId);
            return updatedSaga?.CurrentState == "Refunded";
        }, TimeSpan.FromSeconds(10));

        updatedSaga.Should().NotBeNull();
        updatedSaga!.CurrentState.Should().Be("Refunded");
    }
}

