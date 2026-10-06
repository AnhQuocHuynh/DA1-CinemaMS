using System.Threading.Tasks;
using MassTransit;
using MediatR;
using Microsoft.Extensions.Logging;
using PaymentService.Application.Contracts;
using PaymentService.Application.Features.Payments.Commands;
using PaymentService.Application.IntegrationEvents;

namespace PaymentService.Infrastructure.Messaging.Consumers;

/// <summary>
/// MassTransit consumer for the 'order.created' event published by Booking Service.
///
/// Exchange : booking.events (topic)
/// Routing  : order.created
/// Queue    : payment.order.created
/// </summary>
public class OrderCreatedConsumer : IConsumer<EventEnvelope<OrderCreated>>
{
    private readonly IMediator _mediator;
    private readonly ILogger<OrderCreatedConsumer> _logger;

    public OrderCreatedConsumer(IMediator mediator, ILogger<OrderCreatedConsumer> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<EventEnvelope<OrderCreated>> context)
    {
        var msg = context.Message.Payload;
        _logger.LogInformation("OrderCreated received: OrderId={OrderId}, UserId={UserId}, FinalAmount={Amount}",
            msg.OrderId, msg.UserId, msg.FinalAmount);

        await _mediator.Send(new ReservePaymentSlotCommand(
            msg.OrderId,
            msg.UserId,
            msg.FinalAmount,
            "VND"
        ));
    }
}
