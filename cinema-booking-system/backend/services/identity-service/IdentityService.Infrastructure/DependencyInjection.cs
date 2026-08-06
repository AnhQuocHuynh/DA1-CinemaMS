using IdentityService.Application.Contracts;
using IdentityService.Application.Messages;
using IdentityService.Domain.Interfaces;
using IdentityService.Infrastructure.Data;
using IdentityService.Infrastructure.Keycloak;
using IdentityService.Infrastructure.Messaging;
using IdentityService.Infrastructure.Messaging.Consumers;
using IdentityService.Infrastructure.Repositories;
using MassTransit;
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

        services.AddMassTransit(x =>
        {
            x.AddEntityFrameworkOutbox<UserProfileDbContext>(o =>
            {
                o.UsePostgres();
                o.UseBusOutbox();
            });

            x.AddConsumers(typeof(DependencyInjection).Assembly);

            x.UsingRabbitMq((context, cfg) =>
            {
                cfg.Host(configuration.GetConnectionString("RabbitMq") ?? "amqp://guest:guest@localhost:5672/");
                
                cfg.ConfigureCustomTopology(context);
            });
        });

        return services;
    }
}
