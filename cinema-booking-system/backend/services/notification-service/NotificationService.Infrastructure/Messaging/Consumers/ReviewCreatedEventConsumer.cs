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

public class ReviewCreatedEventConsumer : RabbitMqConsumerBase<EventEnvelope<ReviewCreatedPayload>>
{
    private readonly IServiceScopeFactory _scopeFactory;

    protected override string ExchangeName => "booking.events";
    protected override string RoutingKey => "review.created";
    protected override string QueueName => "notification.review.moderation";

    public ReviewCreatedEventConsumer(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger<ReviewCreatedEventConsumer> logger,
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger, scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ProcessMessageAsync(EventEnvelope<ReviewCreatedPayload> message, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        var command = new SendNotificationCommand(
            message.Payload.UserId,
            NotificationType.REVIEW_MODERATION,
            NotificationChannel.PUSH,
            "Review Submitted",
            $"Your review (rating: {message.Payload.Rating}/10) has been submitted and is under moderation.",
            new Dictionary<string, object>
            {
                { "reviewId", message.Payload.ReviewId },
                { "movieId", message.Payload.MovieId ?? 0L },
                { "rating", message.Payload.Rating ?? 0 },
                { "status", message.Payload.Status ?? string.Empty }
            }
        );

        await mediator.Send(command, cancellationToken);
    }
}
