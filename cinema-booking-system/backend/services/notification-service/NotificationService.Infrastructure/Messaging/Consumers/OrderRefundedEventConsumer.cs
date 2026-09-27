using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Application.Messages;
using NotificationService.Application.Contracts;
using NotificationService.Domain.Enums;

namespace NotificationService.Infrastructure.Messaging.Consumers;

public class OrderRefundedEventConsumer : RabbitMqConsumerBase<EventEnvelope<OrderRefundedPayload>>
{
    private readonly IServiceScopeFactory _scopeFactory;

    protected override string ExchangeName => "booking.events";
    protected override string RoutingKey => "order.refunded";
    protected override string QueueName => "notification.order.refund";

    public OrderRefundedEventConsumer(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger<OrderRefundedEventConsumer> logger,
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ProcessMessageAsync(EventEnvelope<OrderRefundedPayload> message, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        
        // 1. Send the Real-Time Update to the Dashboard
        var broadcaster = scope.ServiceProvider.GetRequiredService<IDashboardBroadcaster>();
        await broadcaster.BroadcastRefundUpdateAsync(new 
        {
            type = "OrderRefunded",
            orderId = message.Payload.OrderId,
            amount = message.Payload.RefundAmount,
            reason = message.Payload.Reason
        });

        // 2. Send the Email Notification via MediatR
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        var command = new SendNotificationCommand(
            message.Payload.UserId,
            NotificationType.PAYMENT_RECEIPT,
            NotificationChannel.EMAIL,
            $"Refund processed for Order #{message.Payload.OrderId}",
            $"A refund of {message.Payload.RefundAmount} has been processed. Reason: {message.Payload.Reason}",
            new Dictionary<string, object>
            {
                { "orderId", message.Payload.OrderId }
            }
        );

        await mediator.Send(command, cancellationToken);
    }
}
