using System;
using MassTransit;
using PaymentService.Application.Contracts;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Infrastructure.Data;
using PaymentService.Infrastructure.Messaging.Consumers;
using PaymentService.Infrastructure.Sagas;

namespace PaymentService.Infrastructure.Messaging;

public static class RabbitMqConfigurationExtensions
{
    public static void ConfigureCustomTopology(this IRabbitMqBusFactoryConfigurator cfg, IBusRegistrationContext ctx)
    {
        // Use Raw JSON Serializer to match custom Envelope schema exactly
        cfg.UseRawJsonSerializer();

        // Retry policy: 3 attempts with exponential back-off before dead-letter
        cfg.UseMessageRetry(r => r.Exponential(3,
            TimeSpan.FromSeconds(1),
            TimeSpan.FromSeconds(15),
            TimeSpan.FromSeconds(2)));

        // Set entity name to the shared exchange for all envelopes
        cfg.Message<EventEnvelope<PaymentCompleted>>(x => x.SetEntityName("payment.events"));
        cfg.Message<EventEnvelope<PaymentFailed>>(x => x.SetEntityName("payment.events"));
        cfg.Message<EventEnvelope<PaymentRefunded>>(x => x.SetEntityName("payment.events"));

        // Configure them as topic exchanges
        cfg.Publish<EventEnvelope<PaymentCompleted>>(p => p.ExchangeType = "topic");
        cfg.Publish<EventEnvelope<PaymentFailed>>(p => p.ExchangeType = "topic");
        cfg.Publish<EventEnvelope<PaymentRefunded>>(p => p.ExchangeType = "topic");

        // Set the routing keys using the EventType property from the envelope
        cfg.Send<EventEnvelope<PaymentCompleted>>(x => x.UseRoutingKeyFormatter(c => c.Message.EventType));
        cfg.Send<EventEnvelope<PaymentFailed>>(x => x.UseRoutingKeyFormatter(c => c.Message.EventType));
        cfg.Send<EventEnvelope<PaymentRefunded>>(x => x.UseRoutingKeyFormatter(c => c.Message.EventType));

        // ── Receive endpoints ──────────────────────────────────────────
        // Saga queue: receives PaymentInitiated, GatewayCallbackReceived, etc.
        cfg.ReceiveEndpoint("payment.saga", e =>
        {
            e.ConfigureSaga<PaymentSagaState>(ctx);
            // Inbox: EF Core deduplication for this endpoint
            e.UseEntityFrameworkOutbox<PaymentDbContext>(ctx);
        });

        // OrderPaid consumer: receives from booking.events exchange
        cfg.ReceiveEndpoint("payment.order.paid", e =>
        {
            e.ConfigureConsumeTopology = false; // Suppress default CLR-type exchange bindings
            e.ConfigureConsumer<OrderPaidConsumer>(ctx);
            e.Bind("booking.events", b =>
            {
                b.ExchangeType = "topic";
                b.RoutingKey = "order.paid";
            });
            e.UseEntityFrameworkOutbox<PaymentDbContext>(ctx);
        });

        cfg.ConfigureEndpoints(ctx);
    }
}
