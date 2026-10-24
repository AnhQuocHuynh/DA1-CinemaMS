using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Contracts;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Application.Messages;
using NotificationService.Domain.Enums;

namespace NotificationService.Infrastructure.Messaging.Consumers;

public class OrderCancelledEventConsumer : RabbitMqConsumerBase<EventEnvelope<OrderCancelledPayload>>
{
    private readonly IServiceScopeFactory _scopeFactory;

    protected override string ExchangeName => "booking.events";
    protected override string RoutingKey => "order.cancelled";
    protected override string QueueName => "notification.order.cancelled";

    public OrderCancelledEventConsumer(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger<OrderCancelledEventConsumer> logger,
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger, scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected internal override async Task ProcessMessageAsync(EventEnvelope<OrderCancelledPayload> message, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        var reason = !string.IsNullOrWhiteSpace(message.Payload.Reason)
            ? message.Payload.Reason
            : "Your seat reservation session has expired. The held seats have been released.";

        var pushCommand = new SendNotificationCommand(
            message.Payload.UserId,
            NotificationType.BOOKING_CANCELLED,
            NotificationChannel.PUSH,
            $"Reservation Cancelled for Order #{message.Payload.OrderId}",
            reason,
            new Dictionary<string, object>
            {
                { "orderId", message.Payload.OrderId },
                { "failureReason", reason },
                { "actionType", "ORDER_CANCELLED" },
                { "actionUrl", "/user/booking-failed?reason=timeout" }
            }
        );

        await mediator.Send(pushCommand, cancellationToken);
    }
}
