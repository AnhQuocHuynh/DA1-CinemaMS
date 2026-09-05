using CinemaBooking.Shared.Hosting.Extensions;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OpenTelemetry.Metrics;
using OpenTelemetry.Logs;
using PaymentService.Application;
using PaymentService.Infrastructure;
using PaymentService.Presentation.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// ── ASP.NET Core Services ──────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Payment Service API",
        Version = "v1",
        Description = "Cinema Booking System — Payment Service (Stripe, PayPal, Cash)"
    });
    options.AddSecurityDefinition("GatewayAuth", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "Provide X-User-Id header (injected by API Gateway)",
        Name = "X-User-Id",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "GatewayAuth"
    });
});

// ── Clean Architecture Layers ──────────────────────────────────────────────
builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddApplicationServices();

// ── Native Keycloak JWT Authentication ──────────────────────────────────────
builder.Services.AddCinemaAuthentication(builder.Configuration);
builder.Services.AddAuthorization();

// ── Health Checks ──────────────────────────────────────────────────────────
builder.Services.AddHealthChecks();

// ── CORS (development) ────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

// OpenTelemetry Observability
builder.AddCinemaObservability();

var app = builder.Build();

// ── Auto-apply EF Core Migrations ─────────────────────────────────────────
app.Services.MigratePaymentDatabase();

// ── Middleware Pipeline ────────────────────────────────────────────────────
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseInternalApiSecurity();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Payment Service v1"));
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();

// Allow integration tests to reference the assembly
public partial class Program { }
