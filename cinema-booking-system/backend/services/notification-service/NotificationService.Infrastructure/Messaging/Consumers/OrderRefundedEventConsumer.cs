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
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger, scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected internal override async Task ProcessMessageAsync(EventEnvelope<OrderRefundedPayload> message, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        
        // 1. Send the Real-Time Update to the Dashboard
        var broadcaster = scope.ServiceProvider.GetRequiredService<IDashboardBroadcaster>();
        await broadcaster.BroadcastRefundUpdateAsync(new 
        {
            type = "OrderRefunded",
            orderId = message.Payload.OrderId,
            amount = message.Payload.FinalAmount,
            ticketCount = message.Payload.TicketCount
        });

        // 2. Send the Email Notification via MediatR
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        var emailCommand = new SendNotificationCommand(
            message.Payload.UserId,
            NotificationType.ORDER_REFUNDED,
            NotificationChannel.EMAIL,
            $"Refund processed for Order #{message.Payload.OrderId}",
            $"A refund of {message.Payload.FinalAmount:N0} VND has been processed for {message.Payload.TicketCount} ticket(s).",
            new Dictionary<string, object>
            {
                { "orderId", message.Payload.OrderId },
                { "showtimeId", message.Payload.ShowtimeId },
                { "finalAmount", message.Payload.FinalAmount },
                { "ticketCount", message.Payload.TicketCount }
            }
        );

        await mediator.Send(emailCommand, cancellationToken);

        // 3. Send the Real-Time Push Notification via MediatR
        var pushCommand = new SendNotificationCommand(
            message.Payload.UserId,
            NotificationType.ORDER_REFUNDED,
            NotificationChannel.PUSH,
            $"Order #{message.Payload.OrderId} Refunded",
            $"A refund of {message.Payload.FinalAmount:N0} VND has been processed for {message.Payload.TicketCount} ticket(s).",
            new Dictionary<string, object>
            {
                { "orderId", message.Payload.OrderId },
                { "showtimeId", message.Payload.ShowtimeId },
                { "finalAmount", message.Payload.FinalAmount },
                { "ticketCount", message.Payload.TicketCount },
                { "actionType", "ORDER_REFUNDED" },
                { "actionUrl", "/my-tickets" }
            }
        );

        await mediator.Send(pushCommand, cancellationToken);
    }
}

