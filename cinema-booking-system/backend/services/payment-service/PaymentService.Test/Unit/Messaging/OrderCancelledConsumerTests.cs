using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MassTransit;
using MassTransit.Testing;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using PaymentService.Application.Contracts;
using PaymentService.Application.Features.Refunds.Commands;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Domain.Interfaces;
using PaymentService.Infrastructure.Messaging.Consumers;
using PaymentService.Infrastructure.Sagas;
using Xunit;

namespace PaymentService.Test.Unit.Messaging;

public class OrderCancelledConsumerTests
{
    private readonly Mock<IPaymentRepository> _paymentRepoMock;
    private readonly Mock<IMediator> _mediatorMock;
    private readonly OrderCancelledConsumer _consumer;

    public OrderCancelledConsumerTests()
    {
        _paymentRepoMock = new Mock<IPaymentRepository>();
        _mediatorMock = new Mock<IMediator>();
        _consumer = new OrderCancelledConsumer(
            _paymentRepoMock.Object,
            _mediatorMock.Object,
            NullLogger<OrderCancelledConsumer>.Instance);
    }

    private static ConsumeContext<EventEnvelope<OrderCancelled>> CreateContext(long orderId, long userId, string reason)
    {
        var contextMock = new Mock<ConsumeContext<EventEnvelope<OrderCancelled>>>();
        contextMock.Setup(c => c.Message).Returns(new EventEnvelope<OrderCancelled>
        {
            EventType = "order.cancelled",
            Source = "booking-service",
            Payload = new OrderCancelled
            {
                OrderId = orderId,
                UserId = userId,
                Reason = reason
            }
        });
        contextMock.Setup(c => c.CancellationToken).Returns(CancellationToken.None);
        return contextMock.Object;
    }

    [Fact]
    public async Task Consume_WhenPaymentCompleted_ShouldSendExecuteOrderRefundCommand()
    {
        // Arrange
        var payment = new Payment(101, 42, 180000m, "VND", PaymentMethod.STRIPE);
        payment.Complete("pi_stripe_101", "{}");

        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(101, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var ctx = CreateContext(101, 42, "SEATS_UNAVAILABLE_AFTER_PAYMENT");

        // Act
        await _consumer.Consume(ctx);

        // Assert
        _mediatorMock.Verify(m => m.Send(
            It.Is<ExecuteOrderRefundCommand>(cmd =>
                cmd.OrderId == 101 &&
                cmd.Amount == 180000m &&
                cmd.Reason == "SEATS_UNAVAILABLE_AFTER_PAYMENT"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Consume_WhenPaymentAlreadyRefunded_ShouldSkipIdempotently()
    {
        // Arrange
        var payment = new Payment(102, 42, 180000m, "VND", PaymentMethod.STRIPE);
        payment.Complete("pi_stripe_102", "{}");
        var refund = payment.AddRefund(180000m, "SEATS_UNAVAILABLE_AFTER_PAYMENT");
        refund.Approve();
        refund.Process();
        payment.MarkAsRefunded();

        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(102, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var ctx = CreateContext(102, 42, "SEATS_UNAVAILABLE_AFTER_PAYMENT");

        // Act
        await _consumer.Consume(ctx);

        // Assert
        _mediatorMock.Verify(m => m.Send(
            It.IsAny<ExecuteOrderRefundCommand>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Consume_WhenPaymentNotCompleted_ShouldIgnoreWithoutRefunding()
    {
        // Arrange — order cancelled due to payment failure or expiration (Status == PENDING / CREATED)
        var payment = new Payment(103, 42, 180000m, "VND", PaymentMethod.STRIPE);

        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(103, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var ctx = CreateContext(103, 42, "Payment initiation timed out (10 minutes)");

        // Act
        await _consumer.Consume(ctx);

        // Assert
        _mediatorMock.Verify(m => m.Send(
            It.IsAny<ExecuteOrderRefundCommand>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Consume_WhenPaymentNotFound_ShouldIgnoreWithoutThrowing()
    {
        // Arrange
        _paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(999, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        var ctx = CreateContext(999, 42, "SEATS_UNAVAILABLE_AFTER_PAYMENT");

        // Act
        await _consumer.Consume(ctx);

        // Assert
        _mediatorMock.Verify(m => m.Send(
            It.IsAny<ExecuteOrderRefundCommand>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    /// <summary>
    /// Full end-to-end in-memory pipeline test:
    ///   OrderCancelledConsumer -> MediatR -> ExecuteOrderRefundCommandHandler -> Gateway.RefundAsync
    ///   -> Publish(RefundRequested) -> PaymentStateMachine (Completed -> Refunded)
    ///   -> Publish(EventEnvelope&lt;PaymentRefunded&gt;)
    /// Also verifies that a duplicate order.cancelled delivery does NOT trigger a double refund.
    /// </summary>
    [Fact]
    public async Task EndToEndInMemory_OrderCancelledAfterPayment_ShouldRefundOnce_TransitionSagaToRefunded_AndEmitPaymentRefunded()
    {
        // Arrange
        var payment = new Payment(5001, 42, 220000m, "VND", PaymentMethod.STRIPE);
        var paymentRepoMock = new Mock<IPaymentRepository>();
        var uowMock = new Mock<IUnitOfWork>();
        var gatewayFactoryMock = new Mock<IPaymentGatewayFactory>();
        var gatewayMock = new Mock<IPaymentGateway>();

        paymentRepoMock
            .Setup(r => r.GetByOrderIdAsync(5001, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);
        paymentRepoMock
            .Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        gatewayFactoryMock
            .Setup(f => f.GetGateway(PaymentMethod.STRIPE))
            .Returns(gatewayMock.Object);
        gatewayMock
            .Setup(g => g.RefundAsync("pi_stripe_5001", 220000m, "VND"))
            .ReturnsAsync(new RefundResult(true, null));

        var services = new ServiceCollection();
        services.AddSingleton(typeof(ILogger<>), typeof(NullLogger<>));
        services.AddSingleton(paymentRepoMock.Object);
        services.AddSingleton(uowMock.Object);
        services.AddSingleton(gatewayFactoryMock.Object);
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssemblyContaining<ExecuteOrderRefundCommand>());

        services.AddMassTransitTestHarness(x =>
        {
            x.AddConsumer<OrderCancelledConsumer>();
            x.AddSagaStateMachine<PaymentStateMachine, PaymentSagaState>()
                .InMemoryRepository();
        });

        await using var provider = services.BuildServiceProvider(true);
        var harness = provider.GetRequiredService<ITestHarness>();
        var sagaHarness = harness.GetSagaStateMachineHarness<PaymentStateMachine, PaymentSagaState>();

        await harness.Start();
        try
        {
            // Step 1: Drive Saga to Completed (simulating normal payment completion)
            await harness.Bus.Publish(new PaymentInitiated
            {
                CorrelationId = payment.SagaId,
                PaymentId = payment.Id,
                OrderId = payment.OrderId,
                UserId = payment.UserId,
                Amount = payment.Amount,
                Currency = payment.Currency,
                PaymentMethod = "STRIPE"
            });
            await Task.Delay(50);

            await harness.Bus.Publish(new GatewayCallbackReceived
            {
                CorrelationId = payment.SagaId,
                PaymentMethod = "STRIPE",
                IsSuccess = true,
                TransactionId = "pi_stripe_5001",
                RawResponse = "{}"
            });

            // Wait for Saga to reach Completed and domain Payment to be marked COMPLETED
            var deadline = DateTime.UtcNow.AddSeconds(3);
            while (DateTime.UtcNow < deadline)
            {
                if (sagaHarness.Sagas.Select(s => s.CorrelationId == payment.SagaId && s.CurrentState == "Completed").Any())
                    break;
                await Task.Delay(50);
            }
            Assert.Equal(PaymentStatus.COMPLETED, payment.Status);

            // Step 2: Booking Service emits order.cancelled (SEATS_UNAVAILABLE_AFTER_PAYMENT)
            var orderCancelledEnvelope = new EventEnvelope<OrderCancelled>
            {
                EventId = Guid.NewGuid(),
                EventType = "order.cancelled",
                Source = "booking-service",
                Payload = new OrderCancelled
                {
                    OrderId = 5001,
                    UserId = 42,
                    Reason = "SEATS_UNAVAILABLE_AFTER_PAYMENT"
                }
            };

            await harness.Bus.Publish(orderCancelledEnvelope);

            // Step 3: Wait for Saga to transition from Completed -> Refunded
            while (DateTime.UtcNow < deadline)
            {
                if (sagaHarness.Sagas.Select(s => s.CorrelationId == payment.SagaId && s.CurrentState == "Refunded").Any())
                    break;
                await Task.Delay(50);
            }

            var sagaInstance = sagaHarness.Sagas.Contains(payment.SagaId);
            Assert.NotNull(sagaInstance);
            Assert.Equal("Refunded", sagaInstance.CurrentState);
            Assert.Equal(PaymentStatus.REFUNDED, payment.Status);
            Assert.Single(payment.Refunds);

            // Verify payment.refunded integration event was published by the Saga
            Assert.True(await harness.Published.Any<EventEnvelope<PaymentRefunded>>(
                m => m.Context.Message.Payload.OrderId == 5001 &&
                     m.Context.Message.Payload.RefundAmount == 220000m &&
                     m.Context.Message.Payload.Reason == "SEATS_UNAVAILABLE_AFTER_PAYMENT"));

            // Step 4: Publish a duplicate order.cancelled event to prove NO double refund occurs
            await harness.Bus.Publish(orderCancelledEnvelope);
            await Task.Delay(100);

            gatewayMock.Verify(g => g.RefundAsync("pi_stripe_5001", 220000m, "VND"), Times.Once);
            Assert.Single(payment.Refunds);
        }
        finally
        {
            await harness.Stop();
        }
    }
}
