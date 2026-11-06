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
    internal const string SeatsUnavailableAfterPaymentReason = "SEATS_UNAVAILABLE_AFTER_PAYMENT";

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

        var payload = message.Payload;
        var isRefundedCompensation = payload.Reason == SeatsUnavailableAfterPaymentReason;

        string title;
        string body;
        string actionUrl;
        if (isRefundedCompensation)
        {
            title = $"Payment Refunded for Order #{payload.OrderId}";
            body = "Your payment was received, but the seats were taken after your hold timed out. " +
                   "A full refund is being returned to your original payment method.";
            actionUrl = $"/user/booking-failed?reason=cancelled&orderId={payload.OrderId}";
        }
        else
        {
            title = $"Reservation Cancelled for Order #{payload.OrderId}";
            body = !string.IsNullOrWhiteSpace(payload.Reason)
                ? payload.Reason
                : "Your seat reservation session has expired. The held seats have been released.";
            actionUrl = "/user/booking-failed?reason=timeout";
        }

        var pushCommand = new SendNotificationCommand(
            payload.UserId,
            NotificationType.BOOKING_CANCELLED,
            NotificationChannel.PUSH,
            title,
            body,
            new Dictionary<string, object>
            {
                { "orderId", payload.OrderId },
                { "failureReason", body },
                { "actionType", isRefundedCompensation ? "ORDER_REFUNDED_SEATS_UNAVAILABLE" : "ORDER_CANCELLED" },
                { "actionUrl", actionUrl }
            }
        );

        await mediator.Send(pushCommand, cancellationToken);
    }
}
