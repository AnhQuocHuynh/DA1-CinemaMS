using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.Contracts;
using FacilityService.Infrastructure.Data;
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
using StackExchange.Redis;
using Testcontainers.PostgreSql;
using Testcontainers.Redis;
using Xunit;

namespace FacilityService.Test.Integration;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder()
        .WithImage("postgres:18-alpine")
        .WithDatabase("facility_db")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    private readonly RedisContainer _redisContainer = new RedisBuilder()
        .WithImage("redis:7-alpine")
        .Build();

    private IConnectionMultiplexer? _multiplexer;

    public async Task InitializeAsync()
    {
        await Task.WhenAll(_dbContainer.StartAsync(), _redisContainer.StartAsync());

        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _dbContainer.GetConnectionString());
        Environment.SetEnvironmentVariable("ConnectionStrings__RedisConnection", _redisContainer.GetConnectionString());
    }

    public new async Task DisposeAsync()
    {
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", null);
        Environment.SetEnvironmentVariable("ConnectionStrings__RedisConnection", null);

        if (_multiplexer != null)
        {
            await _multiplexer.DisposeAsync();
        }

        await Task.WhenAll(_dbContainer.DisposeAsync().AsTask(), _redisContainer.DisposeAsync().AsTask());
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:DefaultConnection", _dbContainer.GetConnectionString());
        builder.UseSetting("ConnectionStrings:RedisConnection", _redisContainer.GetConnectionString());

        builder.ConfigureAppConfiguration((context, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "ConnectionStrings:DefaultConnection", _dbContainer.GetConnectionString() },
                { "ConnectionStrings:RedisConnection", _redisContainer.GetConnectionString() }
            });
        });

        builder.ConfigureServices(services =>
        {
            // Remove the existing DbContext registration
            services.RemoveAll(typeof(DbContextOptions<FacilityDbContext>));

            // Add a database context using the Testcontainer connection string
            services.AddDbContext<FacilityDbContext>(options =>
            {
                options.UseNpgsql(_dbContainer.GetConnectionString());
            });

            // Override IConnectionMultiplexer and RedisCacheOptions with the Testcontainer connection
            services.RemoveAll(typeof(IConnectionMultiplexer));
            _multiplexer = ConnectionMultiplexer.Connect(_redisContainer.GetConnectionString());
            services.AddSingleton<IConnectionMultiplexer>(_multiplexer);

            services.PostConfigure<Microsoft.Extensions.Caching.StackExchangeRedis.RedisCacheOptions>(options =>
            {
                options.Configuration = _redisContainer.GetConnectionString();
                options.ConnectionMultiplexerFactory = () => Task.FromResult<IConnectionMultiplexer>(_multiplexer);
            });
            
            // Mock Showtime Service Client
            var showtimeServiceMock = new Mock<IShowtimeServiceClient>();
            showtimeServiceMock
                .Setup(x => x.HasFutureShowtimesAsync(It.IsAny<System.Collections.Generic.List<long>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);
                
            services.RemoveAll(typeof(IShowtimeServiceClient));
            services.AddSingleton(showtimeServiceMock.Object);
            
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
