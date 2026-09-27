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

public class UserRegisteredEventConsumer : RabbitMqConsumerBase<EventEnvelope<KeycloakUserRegisteredPayload>>
{
    private readonly IServiceScopeFactory _scopeFactory;

    protected override string ExchangeName => "user.events";
    protected override string RoutingKey => "user.registered";
    protected override string QueueName => "notification.user.welcome";

    public UserRegisteredEventConsumer(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger<UserRegisteredEventConsumer> logger,
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ProcessMessageAsync(EventEnvelope<KeycloakUserRegisteredPayload> message, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        // TODO: Map KeycloakId to internal numeric UserId. 
        // Using a default value to satisfy the command validation for now.
        long defaultUserId = 1;

        var command = new SendNotificationCommand(
            defaultUserId,
            NotificationType.PROMOTIONAL,
            NotificationChannel.EMAIL,
            "Welcome to Cinema Booking",
            $"Hello {message.Payload.FullName}, welcome to our platform!",
            new Dictionary<string, object>
            {
                { "keycloakId", message.Payload.KeycloakId },
                { "email", message.Payload.Email }
            }
        );

        await mediator.Send(command, cancellationToken);
    }
}
