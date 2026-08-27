using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NotificationService.Application.Contracts;
using NotificationService.Domain.Interfaces;
using NotificationService.Infrastructure.BackgroundServices;
using NotificationService.Infrastructure.Data;
using NotificationService.Infrastructure.Messaging;
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

        // Services
        services.AddTransient<IEmailSender, MailKitEmailSender>();
        services.AddTransient<ISmsSender, DummySmsSender>();
        services.AddTransient<IPushNotificationSender, SignalRPushSender>();
        services.AddTransient<ITemplateRenderer, TemplateRenderer>();

        // Background Services
        services.AddHostedService<NotificationDispatcherService>();
        
        // Note: RabbitMQ consumers would be registered here as HostedServices
        // services.AddHostedService<UserRegisteredEventConsumer>();

        return services;
    }
}
