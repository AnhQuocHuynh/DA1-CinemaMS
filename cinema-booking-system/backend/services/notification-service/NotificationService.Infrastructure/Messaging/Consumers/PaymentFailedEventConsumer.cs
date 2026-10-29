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

public class PaymentFailedEventConsumer : RabbitMqConsumerBase<EventEnvelope<PaymentFailedPayload>>
{
    private readonly IServiceScopeFactory _scopeFactory;

    protected override string ExchangeName => "payment.events";
    protected override string RoutingKey => "payment.failed";
    protected override string QueueName => "notification.payment.failed";

    public PaymentFailedEventConsumer(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger<PaymentFailedEventConsumer> logger,
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger, scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected internal override async Task ProcessMessageAsync(EventEnvelope<PaymentFailedPayload> message, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        var reason = !string.IsNullOrWhiteSpace(message.Payload.Reason)
            ? message.Payload.Reason
            : "Payment could not be processed. Your card was declined or transaction timed out.";

        var pushCommand = new SendNotificationCommand(
            message.Payload.UserId,
            NotificationType.PAYMENT_FAILED,
            NotificationChannel.PUSH,
            $"Payment Failed for Order #{message.Payload.OrderId}",
            reason,
            new Dictionary<string, object>
            {
                { "orderId", message.Payload.OrderId },
                { "paymentId", message.Payload.PaymentId ?? 0L },
                { "failureReason", reason },
                { "actionType", "PAYMENT_FAILED" },
                { "actionUrl", $"/user/checkout?orderId={message.Payload.OrderId}" }
            }
        );

        await mediator.Send(pushCommand, cancellationToken);
    }
}
