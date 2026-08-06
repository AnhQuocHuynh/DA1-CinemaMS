using MassTransit;
using Microsoft.Extensions.Logging;
using PaymentService.Application.IntegrationEvents;

namespace PaymentService.Infrastructure.Messaging.Consumers;

/// <summary>
/// MassTransit consumer for the 'order.paid' event published by Booking Service.
/// 
/// Exchange : booking.events (topic)
/// Routing  : order.paid
/// Queue    : payment.order.paid
///
/// MassTransit inbox stores the message in DB before processing,
/// ensuring idempotent consumption even if the consumer restarts mid-processing.
/// </summary>
public class OrderPaidConsumer : IConsumer<OrderPaid>
{
    private readonly ILogger<OrderPaidConsumer> _logger;

    public OrderPaidConsumer(ILogger<OrderPaidConsumer> logger)
    {
        _logger = logger;
    }

    public Task Consume(ConsumeContext<OrderPaid> context)
    {
        var msg = context.Message;

        // Payment Service currently has no action to take when order.paid is received
        // (the payment was already completed before the booking service generates this event).
        // This consumer exists as the extension point for future analytics / reconciliation.
        _logger.LogInformation(
            "OrderPaid received: OrderId={OrderId}, UserId={UserId}, TxId={TxId}, Tickets={Count}",
            msg.OrderId, msg.UserId, msg.TransactionId, msg.TicketCount);

        return Task.CompletedTask;
    }
}
