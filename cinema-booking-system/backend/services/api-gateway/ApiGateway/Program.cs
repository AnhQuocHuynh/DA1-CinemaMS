using CinemaBooking.Shared.Hosting.Extensions;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OpenTelemetry.Metrics;
using OpenTelemetry.Logs;
using ApiGateway.HealthChecks;
using ApiGateway.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Security.Claims;
using System.Text.Json;
using System.Threading.Tasks;
using System;
using Polly;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Http;
using StackExchange.Redis;
using System.Linq;
using System.Collections.Generic;
using Microsoft.Extensions.Logging;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// Configure HttpClient for User Profile Resolution with Resilience
builder.Services.AddHttpClient("UserProfileClient")
    .AddStandardResilienceHandler(options =>
    {
        // 3 retries, exponential backoff starting at 2s + jitter
        options.Retry.MaxRetryAttempts = 3;
        options.Retry.Delay = TimeSpan.FromSeconds(2);
        options.Retry.BackoffType = DelayBackoffType.Exponential;
        options.Retry.UseJitter = true;

        // Circuit Breaker: Break for 30s after ~5 consecutive failures
        options.CircuitBreaker.BreakDuration = TimeSpan.FromSeconds(30);
        options.CircuitBreaker.MinimumThroughput = 5;
        options.CircuitBreaker.FailureRatio = 0.9;
    });

// YARP
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// JWT Authentication (Keycloak OIDC)
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Jwt:Authority"];
        options.Audience = builder.Configuration["Jwt:Audience"];
        options.RequireHttpsMetadata = builder.Configuration.GetValue<bool>("Jwt:RequireHttpsMetadata");
        
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:ValidIssuer"] ?? builder.Configuration["Jwt:Authority"],
            ValidateAudience = true,
            ValidateLifetime = true,
            NameClaimType = "preferred_username",
            RoleClaimType = ClaimTypes.Role
        };
        
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                var logger = context.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("JwtDebug");
                var allClaims = context.Principal?.Claims.Select(c => $"{c.Type}={c.Value[..Math.Min(c.Value.Length, 80)]}").ToList();
                logger.LogWarning("[JWT DEBUG] All claims: {Claims}", string.Join(" | ", allClaims ?? new List<string>()));
                
                var realmAccess = context.Principal?.FindFirst("realm_access");
                logger.LogWarning("[JWT DEBUG] realm_access claim found: {Found}, value: {Value}", 
                    realmAccess != null, realmAccess?.Value?[..Math.Min(realmAccess?.Value?.Length ?? 0, 200)]);
                
                if (realmAccess != null)
                {
                    var parsed = JsonDocument.Parse(realmAccess.Value);
                    if (parsed.RootElement.TryGetProperty("roles", out var roles))
                    {
                        var identity = context.Principal?.Identity as ClaimsIdentity;
                        foreach (var role in roles.EnumerateArray())
                        {
                            var roleStr = role.GetString()?.ToUpperInvariant();
                            logger.LogWarning("[JWT DEBUG] Adding role claim: {Role}", roleStr);
                            if (!string.IsNullOrEmpty(roleStr))
                                identity?.AddClaim(new Claim(ClaimTypes.Role, roleStr));
                        }
                    }
                }
                else
                {
                    logger.LogWarning("[JWT DEBUG] No realm_access claim found! Checking for individual role claims...");
                    var roleClaims = context.Principal?.Claims.Where(c => c.Type.Contains("role", StringComparison.OrdinalIgnoreCase)).ToList();
                    logger.LogWarning("[JWT DEBUG] Role-related claims: {RoleClaims}", string.Join(" | ", roleClaims?.Select(c => $"{c.Type}={c.Value}") ?? Array.Empty<string>()));
                }
                return Task.CompletedTask;
            }
        };
    });

// Authorization Policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("authenticated", p => p.RequireAuthenticatedUser());
    options.AddPolicy("admin", p => p.RequireRole("ADMIN"));
    options.AddPolicy("staff", p => p.RequireRole("STAFF"));
    options.AddPolicy("admin-or-staff", p => p.RequireRole("ADMIN", "STAFF"));
});

// Redis
var redisConnectionString = builder.Configuration["Redis:ConnectionString"];
if (!string.IsNullOrEmpty(redisConnectionString))
{
    var multiplexer = ConnectionMultiplexer.Connect(redisConnectionString);
    builder.Services.AddSingleton<IConnectionMultiplexer>(multiplexer);
    
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.ConnectionMultiplexerFactory = () => Task.FromResult<IConnectionMultiplexer>(multiplexer);
    });
}

// Rate Limiting
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        var remoteIpAddress = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: remoteIpAddress,
            factory: partition => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 300,
                QueueLimit = 20,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                Window = TimeSpan.FromMinutes(1)
            });
    });

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        if (context.HttpContext.Response.HasStarted == false)
        {
            await context.HttpContext.Response.WriteAsync("Too many requests. Please try again later.", cancellationToken: token);
        }
    };

    options.AddPolicy("strict", context =>
    {
        var remoteIpAddress = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: remoteIpAddress,
            factory: partition => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = 30,
                QueueLimit = 0,
                Window = TimeSpan.FromMinutes(1)
            });
    });
});

// Health Checks
builder.Services.AddHealthChecks()
    .AddRedis(builder.Configuration["Redis:ConnectionString"]!)
    .AddCheck<AggregateHealthCheck>("upstream-services");

// CORS
builder.Services.AddCors();

// OpenTelemetry Observability
builder.AddCinemaObservability();

var app = builder.Build();

app.UseCors(policy => policy
    .WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? new[] { "*" })
    .AllowAnyMethod()
    .AllowAnyHeader()
    .AllowCredentials());

app.UseAuthentication();
app.UseAuthorization();

app.UseRateLimiter();

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<InternalRouteBlockingMiddleware>();
app.UseMiddleware<KeycloakUserIdResolutionMiddleware>();

app.MapReverseProxy();
app.MapHealthChecks("/health");

app.Run();
