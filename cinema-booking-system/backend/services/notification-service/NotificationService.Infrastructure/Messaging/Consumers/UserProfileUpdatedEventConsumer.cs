using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Messages;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Interfaces;
using NotificationService.Domain.ValueObjects;

namespace NotificationService.Infrastructure.Messaging.Consumers;

public class UserProfileUpdatedEventConsumer : RabbitMqConsumerBase<EventEnvelope<UserProfileUpdatedPayload>>
{
    private readonly IServiceScopeFactory _scopeFactory;

    protected override string ExchangeName => "user.events";
    protected override string RoutingKey => "user.profile.updated";
    protected override string QueueName => "notification.user.profile.updated";

    public UserProfileUpdatedEventConsumer(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger<UserProfileUpdatedEventConsumer> logger,
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger, scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ProcessMessageAsync(EventEnvelope<UserProfileUpdatedPayload> message, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var preferenceRepository = scope.ServiceProvider.GetRequiredService<IUserPreferenceRepository>();

        var existingPref = await preferenceRepository.GetByUserIdAsync(message.Payload.UserId, cancellationToken);
        var contact = new ContactDetails(message.Payload.Email, message.Payload.PhoneNumber);

        if (existingPref == null)
        {
            var newPref = new UserPreference(message.Payload.UserId, contact, emailEnabled: true, smsEnabled: true, pushEnabled: true);
            await preferenceRepository.UpsertAsync(newPref, cancellationToken);
        }
        else
        {
            existingPref.UpdatePreferences(contact, existingPref.EmailEnabled, existingPref.SmsEnabled, existingPref.PushEnabled);
            await preferenceRepository.UpsertAsync(existingPref, cancellationToken);
        }
    }
}
