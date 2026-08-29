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

public class OrderPaidEventConsumer : RabbitMqConsumerBase<EventEnvelope<OrderPaidPayload>>
{
    private readonly IServiceScopeFactory _scopeFactory;

    protected override string ExchangeName => "booking.events";
    protected override string RoutingKey => "order.paid";
    protected override string QueueName => "notification.order.confirmation";

    public OrderPaidEventConsumer(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger<OrderPaidEventConsumer> logger,
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ProcessMessageAsync(EventEnvelope<OrderPaidPayload> message, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        
        // 1. Send the Real-Time Update to the Dashboard
        var broadcaster = scope.ServiceProvider.GetRequiredService<IDashboardBroadcaster>();
        await broadcaster.BroadcastSalesUpdateAsync(new 
        {
            type = "OrderPaid",
            orderId = message.Payload.OrderId,
            amount = message.Payload.FinalAmount,
            ticketCount = message.Payload.TicketCount,
            method = message.Payload.PaymentMethod
        });

        // 2. Send the Email Notification via MediatR
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        var command = new SendNotificationCommand(
            message.Payload.UserId,
            NotificationType.PAYMENT_RECEIPT,
            NotificationChannel.EMAIL,
            $"Order #{message.Payload.OrderId} Confirmed",
            $"Your payment of {message.Payload.FinalAmount} was successful.",
            new Dictionary<string, object>
            {
                { "orderId", message.Payload.OrderId },
                { "showtimeId", message.Payload.ShowtimeId },
                { "transactionId", message.Payload.TransactionId }
            }
        );

        await mediator.Send(command, cancellationToken);
    }
}
