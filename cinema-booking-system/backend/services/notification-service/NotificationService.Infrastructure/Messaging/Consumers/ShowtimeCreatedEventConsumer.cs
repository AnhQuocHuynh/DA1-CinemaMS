using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Application.Messages;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Infrastructure.Messaging.Consumers;

public class ShowtimeCreatedEventConsumer : RabbitMqConsumerBase<EventEnvelope<ShowtimeCreatedPayload>>
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ShowtimeCreatedEventConsumer> _logger;

    protected override string ExchangeName => "showtime.events";
    protected override string RoutingKey => "showtime.created";
    protected override string QueueName => "notification.showtime.new";

    public ShowtimeCreatedEventConsumer(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger<ShowtimeCreatedEventConsumer> logger,
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger, scopeFactory)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ProcessMessageAsync(EventEnvelope<ShowtimeCreatedPayload> message, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
        var preferenceRepository = scope.ServiceProvider.GetRequiredService<IUserPreferenceRepository>();

        // Fetch all users who have opted in to push notifications
        var subscribedUsers = await preferenceRepository.GetAllPushEnabledUserIdsAsync(cancellationToken);
        var userIds = subscribedUsers.ToList();

        if (userIds.Count == 0)
        {
            _logger.LogInformation("No users subscribed to PUSH notifications for showtime {ShowtimeId}. Skipping fan-out.",
                message.Payload.ShowtimeId);
            return;
        }

        _logger.LogInformation("Broadcasting showtime {ShowtimeId} notification to {UserCount} subscribed users",
            message.Payload.ShowtimeId, userIds.Count);

        foreach (var userId in userIds)
        {
            var command = new SendNotificationCommand(
                userId,
                NotificationType.SHOWTIME_REMINDER,
                NotificationChannel.PUSH,
                "New Showtime Available!",
                $"A new showtime for {message.Payload.MovieTitle} has been scheduled at {message.Payload.StartTime}.",
                new Dictionary<string, object>
                {
                    { "showtimeId", message.Payload.ShowtimeId },
                    { "movieId", message.Payload.MovieId ?? 0L }
                }
            );

            await mediator.Send(command, cancellationToken);
        }
    }
}
