using System;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading;
using IdentityService.Application.Contracts;
using IdentityService.Infrastructure.Data;
using MassTransit;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Testcontainers.PostgreSql;
using Xunit;

namespace IdentityService.Test.Integration;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("identity_db")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();
    }

    public new async Task DisposeAsync()
    {
        await _dbContainer.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Remove the existing DbContext registration
            services.RemoveAll(typeof(DbContextOptions<UserProfileDbContext>));

            // Add a database context using the Testcontainer connection string
            services.AddDbContext<UserProfileDbContext>(options =>
            {
                options.UseNpgsql(_dbContainer.GetConnectionString());
            });
            
            // Mock Keycloak Admin Client
            var keycloakMock = new Mock<IKeycloakAdminClient>();
            
            var adminRole = new RoleRepresentation("1", "ADMIN");
            
            keycloakMock
                .Setup(x => x.GetUserRealmRolesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(Array.Empty<RoleRepresentation>());
                
            keycloakMock
                .Setup(x => x.GetRealmRolesAsync(It.IsAny<CancellationToken>()))
                .ReturnsAsync(new[] { adminRole });
                
            services.RemoveAll(typeof(IKeycloakAdminClient));
            services.AddSingleton(keycloakMock.Object);
            
            // Add MassTransit TestHarness to avoid RabbitMQ connection errors
            services.AddMassTransitTestHarness();
            
            // Add Test Authentication handler
            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = "Test";
                options.DefaultChallengeScheme = "Test";
            })
            .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>("Test", options => { });
        });
    }
}

public class TestAuthHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public TestAuthHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : base(options, logger, encoder)
    {
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (Request.Headers.TryGetValue("Authorization", out var authHeader) && authHeader.ToString().StartsWith("Test "))
        {
            var token = authHeader.ToString().Substring(5);
            var parts = token.Split(':');
            var userId = parts[0];
            var role = parts.Length > 1 ? parts[1] : "user";

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId),
                new Claim(ClaimTypes.Role, role),
            };

            var identity = new ClaimsIdentity(claims, "Test");
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, "Test");

            return Task.FromResult(AuthenticateResult.Success(ticket));
        }

        return Task.FromResult(AuthenticateResult.Fail("No Test token provided"));
    }
}
