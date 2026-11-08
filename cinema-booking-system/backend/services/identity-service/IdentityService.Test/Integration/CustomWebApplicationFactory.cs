using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading;
using System.Threading.Tasks;
using IdentityService.Application.Contracts;
using IdentityService.Infrastructure.Data;
using MassTransit;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
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

        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _dbContainer.GetConnectionString());
        Environment.SetEnvironmentVariable("InternalApi__Token", "local-dev-internal-token");
        Environment.SetEnvironmentVariable("INTERNAL_API_TOKEN", "local-dev-internal-token");
    }

    public new async Task DisposeAsync()
    {
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", null);
        Environment.SetEnvironmentVariable("InternalApi__Token", null);
        Environment.SetEnvironmentVariable("INTERNAL_API_TOKEN", null);

        await _dbContainer.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:DefaultConnection", _dbContainer.GetConnectionString());
        builder.UseSetting("InternalApi:Token", "local-dev-internal-token");
        builder.UseSetting("INTERNAL_API_TOKEN", "local-dev-internal-token");

        builder.ConfigureAppConfiguration((context, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "ConnectionStrings:DefaultConnection", _dbContainer.GetConnectionString() },
                { "InternalApi:Token", "local-dev-internal-token" },
                { "INTERNAL_API_TOKEN", "local-dev-internal-token" }
            });
        });

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

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Role, role),
            };

            // If X-User-Id header was provided, respect it as the internal user id
            if (Request.Headers.TryGetValue("X-User-Id", out var xUserId) && !string.IsNullOrWhiteSpace(xUserId))
            {
                claims.Add(new Claim("internal_user_id", xUserId.ToString()));
                claims.Add(new Claim(ClaimTypes.NameIdentifier, xUserId.ToString()));
            }
            else if (long.TryParse(userId, out var numericId) && numericId > 0)
            {
                claims.Add(new Claim("internal_user_id", userId));
                claims.Add(new Claim(ClaimTypes.NameIdentifier, userId));
            }
            else
            {
                // userId is a Keycloak UUID string. Set sub/NameIdentifier, and resolve internal long ID from DB if present
                claims.Add(new Claim(ClaimTypes.NameIdentifier, userId));
                claims.Add(new Claim("sub", userId));

                var db = Context.RequestServices.GetService<UserProfileDbContext>();
                if (db != null)
                {
                    var user = db.Users.AsNoTracking().FirstOrDefault(u => u.KeycloakId == userId);
                    if (user != null)
                    {
                        claims.Add(new Claim("internal_user_id", user.Id.ToString()));
                    }
                }
            }

            var identity = new ClaimsIdentity(claims, "Test");
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, "Test");

            return Task.FromResult(AuthenticateResult.Success(ticket));
        }

        return Task.FromResult(AuthenticateResult.Fail("No Test token provided"));
    }
}
