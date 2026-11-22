using System;
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

    protected internal override async Task ProcessMessageAsync(EventEnvelope<ReviewCreatedPayload> message, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        var rating = message.Payload.Rating ?? 0;
        var isVisible = string.Equals(message.Payload.Status, "VISIBLE", StringComparison.OrdinalIgnoreCase);
        var title = isVisible ? "Review Published" : "Review Submitted";
        var content = isVisible
            ? $"Your review (rating: {rating}/5) has been published."
            : $"Your review (rating: {rating}/5) has been submitted and is under moderation.";

        var command = new SendNotificationCommand(
            message.Payload.UserId,
            NotificationType.REVIEW_MODERATION,
            NotificationChannel.PUSH,
            title,
            content,
            new Dictionary<string, object>
            {
                { "reviewId", message.Payload.ReviewId },
                { "movieId", message.Payload.MovieId ?? 0L },
                { "rating", rating },
                { "status", message.Payload.Status ?? string.Empty }
            }
        );

        await mediator.Send(command, cancellationToken);
    }
}
