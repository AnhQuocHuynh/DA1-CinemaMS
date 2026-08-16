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
        services.AddDbContext<PaymentDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

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
        var rabbitHost = configuration["RabbitMQ:Host"] ?? "localhost";
        var rabbitPort = ushort.Parse(configuration["RabbitMQ:Port"] ?? "5672");
        var rabbitUser = configuration["RabbitMQ:Username"] ?? "guest";
        var rabbitPass = configuration["RabbitMQ:Password"] ?? "guest";
        var rabbitVHost = configuration["RabbitMQ:VirtualHost"] ?? "/";

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
                        builder.UseNpgsql(
                            configuration.GetConnectionString("DefaultConnection"));
                    });
                });

            // ── Transport: RabbitMQ ────────────────────────────────────────────
            x.UsingRabbitMq((ctx, cfg) =>
            {
                cfg.Host(rabbitHost, rabbitPort, rabbitVHost, h =>
                {
                    h.Username(rabbitUser);
                    h.Password(rabbitPass);
                });

                // Retry policy: 3 attempts with exponential back-off before dead-letter
                cfg.UseMessageRetry(r => r.Exponential(3,
                    TimeSpan.FromSeconds(1),
                    TimeSpan.FromSeconds(15),
                    TimeSpan.FromSeconds(2)));

                // ── Custom topology: backward-compatible with Booking Service ──
                // PaymentCompleted → payment.events / payment.completed
                cfg.Message<PaymentCompleted>(t => t.SetEntityName("payment.events"));
                cfg.Publish<PaymentCompleted>(p =>
                {
                    p.ExchangeType = "topic";
                    p.BindQueue("payment.events", "booking.payment.completed",
                        x => x.RoutingKey = "payment.completed");
                });

                // PaymentFailed → payment.events / payment.failed
                cfg.Message<PaymentFailed>(t => t.SetEntityName("payment.events"));
                cfg.Publish<PaymentFailed>(p =>
                {
                    p.ExchangeType = "topic";
                    p.BindQueue("payment.events", "booking.payment.failed",
                        x => x.RoutingKey = "payment.failed");
                });

                // PaymentRefunded → payment.events / payment.refunded
                cfg.Message<PaymentRefunded>(t => t.SetEntityName("payment.events"));
                cfg.Publish<PaymentRefunded>(p =>
                {
                    p.ExchangeType = "topic";
                    p.BindQueue("payment.events", "booking.refund.completed",
                        x => x.RoutingKey = "payment.refunded");
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
