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
            ValidateIssuer = true, // Validate issuer per contract
            ValidateAudience = true,
            ValidateLifetime = true,
            NameClaimType = "preferred_username",
            RoleClaimType = ClaimTypes.Role
        };
        
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                var realmAccess = context.Principal?.FindFirst("realm_access");
                if (realmAccess != null)
                {
                    var parsed = JsonDocument.Parse(realmAccess.Value);
                    if (parsed.RootElement.TryGetProperty("roles", out var roles))
                    {
                        var identity = context.Principal?.Identity as ClaimsIdentity;
                        foreach (var role in roles.EnumerateArray())
                        {
                            identity?.AddClaim(new Claim(ClaimTypes.Role, role.GetString()!));
                        }
                    }
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
builder.Services.AddStackExchangeRedisCache(options =>
    options.Configuration = builder.Configuration["Redis:ConnectionString"]);

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
                PermitLimit = 100,
                QueueLimit = 2,
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
                PermitLimit = 10,
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
