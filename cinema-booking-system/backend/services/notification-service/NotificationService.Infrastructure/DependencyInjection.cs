using System;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NotificationService.Application.Contracts;
using NotificationService.Domain.Interfaces;
using NotificationService.Infrastructure.BackgroundServices;
using NotificationService.Infrastructure.Data;
using NotificationService.Infrastructure.Messaging;
using NotificationService.Infrastructure.Messaging.Consumers;
using NotificationService.Infrastructure.Repositories;
using NotificationService.Infrastructure.Services;

namespace NotificationService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Settings
        services.Configure<MongoDbSettings>(configuration.GetSection("MongoDb"));
        services.Configure<RabbitMqSettings>(configuration.GetSection("RabbitMQ"));

        // RabbitMQ Connection Provider
        services.AddSingleton<IRabbitMqConnectionProvider, RabbitMqConnectionProvider>();

        // MongoDB Context
        services.AddSingleton<MongoDbContext>();

        // Repositories
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<ITemplateRepository, TemplateRepository>();
        services.AddScoped<IDeliveryLogRepository, DeliveryLogRepository>();
        services.AddScoped<IUserPreferenceRepository, UserPreferenceRepository>();
        services.AddScoped<IInboxRepository, InboxRepository>();

        // Services
        services.AddTransient<IEmailSender, MailKitEmailSender>();
        services.AddTransient<ISmsSender, DummySmsSender>();
        // IPushNotificationSender (SignalRPushSender) is registered in Presentation layer (needs IHubContext<NotificationHub>)
        services.AddTransient<ITemplateRenderer, TemplateRenderer>();

        // Keycloak → Internal UserId resolver (calls Identity Service)
        var identityBaseUrl = configuration["IdentityService:BaseUrl"] ?? "http://localhost:5001";
        var internalToken = configuration["InternalApi:Token"] ?? configuration["INTERNAL_API_TOKEN"];
        services.AddHttpClient<IKeycloakUserResolver, HttpKeycloakUserResolver>(client =>
        {
            client.BaseAddress = new Uri(identityBaseUrl);
            if (!string.IsNullOrWhiteSpace(internalToken))
            {
                client.DefaultRequestHeaders.Add("X-Internal-Token", internalToken);
            }
        });

        // Background Services
        services.AddHostedService<NotificationDispatcherService>();
        
        // RabbitMQ Consumers
        services.AddHostedService<UserRegisteredEventConsumer>();
        services.AddHostedService<UserProfileUpdatedEventConsumer>();
        services.AddHostedService<PasswordResetEventConsumer>();
        services.AddHostedService<OrderPaidEventConsumer>();
        services.AddHostedService<OrderRefundedEventConsumer>();
        services.AddHostedService<ReviewCreatedEventConsumer>();
        services.AddHostedService<ShowtimeCreatedEventConsumer>();

        return services;
    }
}
