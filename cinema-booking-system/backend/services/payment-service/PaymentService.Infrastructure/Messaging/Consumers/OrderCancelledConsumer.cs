using System;
using System.Linq;
using System.Threading.Tasks;
using MassTransit;
using MediatR;
using Microsoft.Extensions.Logging;
using PaymentService.Application.Contracts;
using PaymentService.Application.Features.Refunds.Commands;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Enums;
using PaymentService.Domain.Interfaces;

namespace PaymentService.Infrastructure.Messaging.Consumers;

/// <summary>
/// MassTransit consumer for the 'order.cancelled' event published by Booking Service.
///
/// Exchange : booking.events (topic)
/// Routing  : order.cancelled
/// Queue    : payment.order.cancelled
///
/// Handles post-payment Saga compensation (e.g. SEATS_UNAVAILABLE_AFTER_PAYMENT)
/// idempotently:
///   - If the payment is COMPLETED (or PARTIALLY_REFUNDED), triggers a gateway refund
///     and transitions the Saga to Refunded.
///   - If the payment is already REFUNDED, or was never captured (CREATED, PENDING,
///     FAILED, EXPIRED), safely ignores the event as a no-op.
/// </summary>
public class OrderCancelledConsumer : IConsumer<EventEnvelope<OrderCancelled>>
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly IMediator _mediator;
    private readonly ILogger<OrderCancelledConsumer> _logger;

    public OrderCancelledConsumer(
        IPaymentRepository paymentRepository,
        IMediator mediator,
        ILogger<OrderCancelledConsumer> logger)
    {
        _paymentRepository = paymentRepository;
        _mediator = mediator;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<EventEnvelope<OrderCancelled>> context)
    {
        var msg = context.Message.Payload;
        _logger.LogInformation(
            "OrderCancelled received: OrderId={OrderId}, UserId={UserId}, Reason={Reason}",
            msg.OrderId, msg.UserId, msg.Reason);

        var payment = await _paymentRepository.GetByOrderIdAsync(msg.OrderId, context.CancellationToken);
        if (payment == null)
        {
            _logger.LogWarning(
                "OrderCancelled received for OrderId={OrderId}, but no payment record exists; skipping.",
                msg.OrderId);
            return;
        }

        if (payment.Status == PaymentStatus.REFUNDED)
        {
            _logger.LogInformation(
                "OrderCancelled received for OrderId={OrderId}, PaymentId={PaymentId} is already REFUNDED; skipping idempotently.",
                msg.OrderId, payment.Id);
            return;
        }

        if (payment.Status != PaymentStatus.COMPLETED && payment.Status != PaymentStatus.PARTIALLY_REFUNDED)
        {
            _logger.LogInformation(
                "OrderCancelled received for OrderId={OrderId} with PaymentId={PaymentId} in status {Status}; no gateway refund required.",
                msg.OrderId, payment.Id, payment.Status);
            return;
        }

        decimal alreadyRefunded = payment.Refunds
            .Where(r => r.Status == RefundStatus.APPROVED || r.Status == RefundStatus.PROCESSED)
            .Sum(r => r.Amount);
        decimal refundableAmount = payment.Amount - alreadyRefunded;

        if (refundableAmount <= 0)
        {
            _logger.LogInformation(
                "OrderCancelled received for OrderId={OrderId}, PaymentId={PaymentId} has no remaining refundable balance; skipping.",
                msg.OrderId, payment.Id);
            return;
        }

        var reason = string.IsNullOrWhiteSpace(msg.Reason) ? "ORDER_CANCELLED" : msg.Reason;
        await _mediator.Send(
            new ExecuteOrderRefundCommand(msg.OrderId, refundableAmount, reason),
            context.CancellationToken);
    }
}

