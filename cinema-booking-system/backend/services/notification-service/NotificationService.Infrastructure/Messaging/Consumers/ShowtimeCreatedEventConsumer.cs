using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Application.Messages;
using NotificationService.Domain.Enums;

namespace NotificationService.Infrastructure.Messaging.Consumers;

public class ShowtimeCreatedEventConsumer : RabbitMqConsumerBase<EventEnvelope<ShowtimeCreatedPayload>>
{
    private readonly IServiceScopeFactory _scopeFactory;

    protected override string ExchangeName => "showtime.events";
    protected override string RoutingKey => "showtime.created";
    protected override string QueueName => "notification.showtime.new";

    public ShowtimeCreatedEventConsumer(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger<ShowtimeCreatedEventConsumer> logger,
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ProcessMessageAsync(EventEnvelope<ShowtimeCreatedPayload> message, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        // For a broadcast event, we would ideally fetch a list of subscribed users.
        // For demonstration, we just log/send a dummy notification to user 1.
        long defaultUserId = 1;

        var command = new SendNotificationCommand(
            defaultUserId,
            NotificationType.PROMOTIONAL,
            NotificationChannel.PUSH,
            "New Showtime Available!",
            $"A new showtime for {message.Payload.MovieTitle} has been scheduled at {message.Payload.StartTime}.",
            new Dictionary<string, object>
            {
                { "showtimeId", message.Payload.ShowtimeId },
                { "movieId", message.Payload.MovieId }
            }
        );

        await mediator.Send(command, cancellationToken);
    }
}
