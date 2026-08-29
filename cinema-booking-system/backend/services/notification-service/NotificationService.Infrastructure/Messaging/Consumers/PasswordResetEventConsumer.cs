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

public class PasswordResetEventConsumer : RabbitMqConsumerBase<EventEnvelope<KeycloakPasswordResetPayload>>
{
    private readonly IServiceScopeFactory _scopeFactory;

    protected override string ExchangeName => "user.events";
    protected override string RoutingKey => "user.password.reset";
    protected override string QueueName => "notification.password.reset";

    public PasswordResetEventConsumer(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger<PasswordResetEventConsumer> logger,
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ProcessMessageAsync(EventEnvelope<KeycloakPasswordResetPayload> message, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        // TODO: Map KeycloakId to internal numeric UserId.
        long defaultUserId = 1;

        var command = new SendNotificationCommand(
            defaultUserId,
            NotificationType.PASSWORD_RESET,
            NotificationChannel.EMAIL,
            "Password Reset Request",
            $"You requested a password reset. Use this token: {message.Payload.ResetToken}",
            new Dictionary<string, object>
            {
                { "keycloakId", message.Payload.KeycloakId },
                { "email", message.Payload.Email }
            }
        );

        await mediator.Send(command, cancellationToken);
    }
}
