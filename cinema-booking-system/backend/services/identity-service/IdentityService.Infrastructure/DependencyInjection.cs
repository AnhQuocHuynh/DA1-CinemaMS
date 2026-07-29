using IdentityService.Application.Contracts;
using IdentityService.Domain.Interfaces;
using IdentityService.Infrastructure.Data;
using IdentityService.Infrastructure.Keycloak;
using IdentityService.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IdentityService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<UserProfileDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Keycloak Admin REST API client
        services.Configure<KeycloakAdminOptions>(configuration.GetSection(KeycloakAdminOptions.SectionName));
        services.AddMemoryCache();
        services.AddHttpClient<IKeycloakAdminClient, KeycloakAdminClient>();

        services.AddSingleton<Messaging.IRabbitMQConnectionProvider, Messaging.RabbitMQConnectionProvider>();
        services.AddScoped<IdentityService.Application.Contracts.IEventPublisher, Messaging.Publishers.RabbitMqEventPublisher>();

        services.AddHostedService<Messaging.Consumers.KeycloakUserRegisteredConsumer>();
        services.AddHostedService<Messaging.Consumers.KeycloakUserDeletedConsumer>();

        return services;
    }
}

