using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PaymentService.Application.Contracts;
using PaymentService.Application.IntegrationEvents;
using PaymentService.Domain.Interfaces;
using PaymentService.Infrastructure.Data;
using PaymentService.Infrastructure.Gateways;
using PaymentService.Infrastructure.Messaging.Consumers;
using PaymentService.Infrastructure.Repositories;
using PaymentService.Infrastructure.Sagas;

namespace PaymentService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // --- Database ---
        services.AddDbContext<PaymentDbContext>((provider, options) =>
        {
            var config = provider.GetRequiredService<IConfiguration>();
            var connectionString = config.GetConnectionString("DefaultConnection") 
                ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
            options.UseNpgsql(connectionString);
        });

        // --- Repositories ---
        services.AddScoped<IPaymentRepository, PaymentRepository>();
        services.AddScoped<IRefundRepository, RefundRepository>();
        services.AddScoped<ITransactionLogRepository, TransactionLogRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // --- Payment Gateways ---
        services.AddScoped<StripeGateway>();
        services.AddScoped<PayPalGateway>();
        services.AddScoped<CashGateway>();
        services.AddScoped<IPaymentGatewayFactory, PaymentGatewayFactory>();

        // Named HttpClient for PayPal REST calls
        services.AddHttpClient("PayPal", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
        });

        // --- MassTransit: RabbitMQ + EF Core Outbox + Saga ---
        services.AddMassTransit(x =>
        {
            // ── Consumers ──────────────────────────────────────────────────────
            x.AddConsumer<OrderPaidConsumer>();

            // ── Saga (state machine + EF Core persistence) ─────────────────────
            x.AddSagaStateMachine<PaymentStateMachine, PaymentSagaState>()
                .EntityFrameworkRepository(r =>
                {
                    r.ConcurrencyMode = ConcurrencyMode.Optimistic;
                    r.AddDbContext<DbContext, PaymentDbContext>((provider, builder) =>
                    {
                        var config = provider.GetRequiredService<IConfiguration>();
                        var connectionString = config.GetConnectionString("DefaultConnection") 
                            ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
                        builder.UseNpgsql(connectionString);
                    });
                });

            // ── Outbox ─────────────────────────────────────────────────────────
            x.AddEntityFrameworkOutbox<PaymentDbContext>(o =>
            {
                o.QueryDelay = TimeSpan.FromSeconds(1);
                o.UsePostgres();
                o.UseBusOutbox();
            });

            // ── Transport: RabbitMQ ────────────────────────────────────────────
            x.UsingRabbitMq((ctx, cfg) =>
            {
                var config = ctx.GetRequiredService<IConfiguration>();
                var host = config["RabbitMQ:HostName"] 
                    ?? Environment.GetEnvironmentVariable("RabbitMQ__HostName") ?? "localhost";
                var portStr = config["RabbitMQ:Port"] 
                    ?? Environment.GetEnvironmentVariable("RabbitMQ__Port") ?? "5672";
                var port = ushort.Parse(portStr);
                var user = config["RabbitMQ:UserName"] 
                    ?? Environment.GetEnvironmentVariable("RabbitMQ__UserName") ?? "guest";
                var pass = config["RabbitMQ:Password"] 
                    ?? Environment.GetEnvironmentVariable("RabbitMQ__Password") ?? "guest";
                var vhost = config["RabbitMQ:VirtualHost"] 
                    ?? Environment.GetEnvironmentVariable("RabbitMQ__VirtualHost") ?? "/";

                cfg.Host(host, port, vhost, h =>
                {
                    h.Username(user);
                    h.Password(pass);
                });

                // Use Raw JSON Serializer to match custom Envelope schema exactly
                cfg.UseRawJsonSerializer();

                // Retry policy: 3 attempts with exponential back-off before dead-letter
                cfg.UseMessageRetry(r => r.Exponential(3,
                    TimeSpan.FromSeconds(1),
                    TimeSpan.FromSeconds(15),
                    TimeSpan.FromSeconds(2)));

                // PaymentCompleted
                cfg.Publish<EventEnvelope<PaymentCompleted>>(p =>
                {
                    p.ExchangeType = "topic";
                    p.BindQueue("payment.events", "booking.payment.completed", x =>
                    {
                        x.ExchangeType = "topic";
                        x.RoutingKey = "payment.completed";
                    });
                });

                // PaymentFailed
                cfg.Publish<EventEnvelope<PaymentFailed>>(p =>
                {
                    p.ExchangeType = "topic";
                    p.BindQueue("payment.events", "booking.payment.failed", x =>
                    {
                        x.ExchangeType = "topic";
                        x.RoutingKey = "payment.failed";
                    });
                });

                // PaymentRefunded
                cfg.Publish<EventEnvelope<PaymentRefunded>>(p =>
                {
                    p.ExchangeType = "topic";
                    p.BindQueue("payment.events", "booking.refund.completed", x =>
                    {
                        x.ExchangeType = "topic";
                        x.RoutingKey = "payment.refunded";
                    });
                });

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
                    e.ConfigureConsumer<OrderPaidConsumer>(ctx);
                    e.Bind("booking.events", b =>
                    {
                        b.ExchangeType = "topic";
                        b.RoutingKey = "order.paid";
                    });
                    e.UseEntityFrameworkOutbox<PaymentDbContext>(ctx);
                });

                cfg.ConfigureEndpoints(ctx);
            });
        });

        return services;
    }
}
