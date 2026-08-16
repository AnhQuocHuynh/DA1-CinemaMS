using IdentityService.Application.Messages;
using IdentityService.Infrastructure.Messaging.Consumers;
using MassTransit;
using RabbitMQ.Client;

namespace IdentityService.Infrastructure.Messaging;

public static class RabbitMqConfigurationExtensions
{
    public static void ConfigureCustomTopology(this IRabbitMqBusFactoryConfigurator cfg, IBusRegistrationContext context)
    {
        // Use Raw JSON to preserve compatibility with Spring Boot
        cfg.UseRawJsonSerializer();

        // Custom Topology for Publishers
        cfg.Message<IdentityService.Application.Contracts.EventEnvelope<UserProfileUpdatedPayload>>(e => e.SetEntityName("user.events"));
        cfg.Publish<IdentityService.Application.Contracts.EventEnvelope<UserProfileUpdatedPayload>>(e => e.ExchangeType = ExchangeType.Topic);
        cfg.Send<IdentityService.Application.Contracts.EventEnvelope<UserProfileUpdatedPayload>>(e => e.UseRoutingKeyFormatter(context => "user.profile.updated"));

        // Custom Topology for Consumers
        cfg.ReceiveEndpoint("identity-service.user-registered", e =>
        {
            e.ConfigureConsumeTopology = false; // Don't create default exchange bindings
            e.Bind("user.events", x =>
            {
                x.ExchangeType = ExchangeType.Topic;
                x.RoutingKey = "user.registered";
            });
            e.ConfigureConsumer<KeycloakUserRegisteredConsumer>(context);
        });

        cfg.ReceiveEndpoint("identity-service.user-deleted", e =>
        {
            e.ConfigureConsumeTopology = false;
            e.Bind("user.events", x =>
            {
                x.ExchangeType = ExchangeType.Topic;
                x.RoutingKey = "user.deleted";
            });
            e.ConfigureConsumer<KeycloakUserDeletedConsumer>(context);
        });
    }
}
