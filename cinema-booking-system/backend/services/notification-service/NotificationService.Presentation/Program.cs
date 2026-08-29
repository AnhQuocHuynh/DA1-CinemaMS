using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using OpenTelemetry.Metrics;
using OpenTelemetry.Logs;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using NotificationService.Application;
using NotificationService.Application.Contracts;
using NotificationService.Infrastructure;
using NotificationService.Presentation.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddSignalR();
builder.Services.AddSingleton<IDashboardBroadcaster, DashboardBroadcaster>();
builder.Services.AddControllers();
builder.Services.AddHealthChecks();

// OpenTelemetry Observability
var otlpEndpoint = builder.Configuration["Observability:OtlpEndpoint"] ?? "http://localhost:4317";
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService(builder.Environment.ApplicationName))
    .WithTracing(t => t
        .AddAspNetCoreInstrumentation(opts => 
        {
            opts.Filter = context => 
            {
                var path = context.Request.Path.Value;
                return !string.IsNullOrEmpty(path) && !path.Contains("health");
            };
        })
        .AddHttpClientInstrumentation(opts => 
        {
            opts.FilterHttpRequestMessage = req => 
            {
                var path = req.RequestUri?.AbsolutePath;
                return path == null || !path.Contains("health");
            };
        })
        .AddOtlpExporter(o => o.Endpoint = new Uri(otlpEndpoint)))
    .WithMetrics(m => m
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddOtlpExporter(o => o.Endpoint = new Uri(otlpEndpoint)));

builder.Logging.AddOpenTelemetry(logging => {
    logging.IncludeScopes = true;
    logging.AddOtlpExporter(o => o.Endpoint = new Uri(otlpEndpoint));
});

var app = builder.Build();

app.UseAuthorization();

app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");
app.MapHealthChecks("/health");

app.MapGet("/", () => "NotificationService is running!");

app.Run();

public partial class Program { }
