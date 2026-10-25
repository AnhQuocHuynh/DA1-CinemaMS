using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Contracts;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Application.Messages;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using NotificationService.Domain.ValueObjects;

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
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger, scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ProcessMessageAsync(EventEnvelope<KeycloakUserRegisteredPayload> message, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();

        var resolver = scope.ServiceProvider.GetRequiredService<IKeycloakUserResolver>();
        var userId = await resolver.ResolveUserIdAsync(message.Payload.KeycloakId, cancellationToken);

        // Persist user preference with contact details
        var preferenceRepository = scope.ServiceProvider.GetRequiredService<IUserPreferenceRepository>();
        var existingPref = await preferenceRepository.GetByUserIdAsync(userId, cancellationToken);
        var contact = new ContactDetails(message.Payload.Email, message.Payload.PhoneNumber);

        if (existingPref == null)
        {
            var newPref = new UserPreference(userId, contact, emailEnabled: true, smsEnabled: true, pushEnabled: true);
            await preferenceRepository.UpsertAsync(newPref, cancellationToken);
        }
        else
        {
            existingPref.UpdatePreferences(contact, existingPref.EmailEnabled, existingPref.SmsEnabled, existingPref.PushEnabled);
            await preferenceRepository.UpsertAsync(existingPref, cancellationToken);
        }

        var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        var command = new SendNotificationCommand(
            userId,
            NotificationType.PROMOTIONAL,
            NotificationChannel.EMAIL,
            "Welcome to Cinema Booking",
            $"Hello {message.Payload.FullName}, welcome to our platform!",
            new Dictionary<string, object>
            {
                { "keycloakId", message.Payload.KeycloakId },
                { "Email", message.Payload.Email },
                { "email", message.Payload.Email }
            }
        );

        await mediator.Send(command, cancellationToken);
    }
}
