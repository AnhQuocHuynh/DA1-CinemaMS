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
public class OrderCreatedConsumerIntegrationTests : IAsyncLifetime
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly IServiceScope _scope;
    private readonly IBus _bus;
    private readonly PaymentDbContext _dbContext;
    private readonly ITestOutputHelper _output;

    public OrderCreatedConsumerIntegrationTests(CustomWebApplicationFactory factory, ITestOutputHelper output)
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
        // Allow RabbitMQ exchange-queue bindings to settle before publishing
        await Task.Delay(1500);
    }

    public async Task DisposeAsync()
    {
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
    public async Task OrderCreated_ShouldPreReservePaymentSlot_AndInitializeSagaInCreatedState()
    {
        // Arrange
        const long orderId = 8801;
        const long userId = 42;
        const decimal finalAmount = 150000m;

        var envelope = new EventEnvelope<OrderCreated>
        {
            EventId = Guid.NewGuid(),
            EventType = "order.created",
            OccurredAt = DateTime.UtcNow,
            Source = "booking-service",
            Payload = new OrderCreated
            {
                OrderId = orderId,
                UserId = userId,
                TotalAmount = 170000m,
                DiscountAmount = 20000m,
                FinalAmount = finalAmount
            }
        };

        // Act — publish order.created event (routes to booking.events exchange)
        await _bus.Publish(envelope, ctx => ctx.SetRoutingKey("order.created"));

        // Assert 1: Payment entity should be created in DB with status CREATED
        Payment? payment = null;
        await WaitForConditionAsync(async () =>
        {
            payment = await _dbContext.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.OrderId == orderId);
            return payment != null;
        }, TimeSpan.FromSeconds(10));

        payment.Should().NotBeNull("payment slot should be pre-reserved upon receiving order.created");
        payment!.OrderId.Should().Be(orderId);
        payment.UserId.Should().Be(userId);
        payment.Amount.Should().Be(finalAmount);
        payment.Currency.Should().Be("VND");
        payment.Status.Should().Be(PaymentStatus.CREATED);

        // Assert 2: Saga should transition to Created state with the payment details
        PaymentSagaState? saga = null;
        await WaitForConditionAsync(async () =>
        {
            saga = await _dbContext.Set<PaymentSagaState>()
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.CorrelationId == payment.SagaId);
            return saga != null && saga.CurrentState == "Created";
        }, TimeSpan.FromSeconds(10));

        saga.Should().NotBeNull("saga should be initialized by OrderSlotReserved");
        saga!.CurrentState.Should().Be("Created");
        saga.PaymentId.Should().Be(payment.Id);
        saga.OrderId.Should().Be(orderId);
        saga.UserId.Should().Be(userId);
        saga.Amount.Should().Be(finalAmount);
    }

    [Fact]
    public async Task DuplicateOrderCreated_ShouldBeIdempotent_AndNotCreateDuplicatePayment()
    {
        // Arrange
        const long orderId = 8802;
        const long userId = 43;
        const decimal finalAmount = 200000m;

        var envelope = new EventEnvelope<OrderCreated>
        {
            EventId = Guid.NewGuid(),
            EventType = "order.created",
            OccurredAt = DateTime.UtcNow,
            Source = "booking-service",
            Payload = new OrderCreated
            {
                OrderId = orderId,
                UserId = userId,
                TotalAmount = 200000m,
                DiscountAmount = 0m,
                FinalAmount = finalAmount
            }
        };

        // Act — publish first event and wait for creation
        await _bus.Publish(envelope, ctx => ctx.SetRoutingKey("order.created"));

        await WaitForConditionAsync(async () =>
        {
            var count = await _dbContext.Payments.AsNoTracking().CountAsync(p => p.OrderId == orderId);
            return count > 0;
        }, TimeSpan.FromSeconds(10));

        // Publish duplicate event (e.g. message retry/redelivery)
        await _bus.Publish(envelope, ctx => ctx.SetRoutingKey("order.created"));
        await Task.Delay(1000);

        // Assert — exactly 1 payment record exists for this OrderId
        var payments = await _dbContext.Payments.AsNoTracking().Where(p => p.OrderId == orderId).ToListAsync();
        payments.Should().ContainSingle("duplicate order.created events must not create duplicate payment slots");
        payments[0].Status.Should().Be(PaymentStatus.CREATED);
    }
}
