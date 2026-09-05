using System.Reflection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace CinemaBooking.Shared.Hosting.Extensions;

public static class ObservabilityExtensions
{
    public static IHostApplicationBuilder AddCinemaObservability(this IHostApplicationBuilder builder)
    {
        var otlpEndpoint = builder.Configuration["Observability:OtlpEndpoint"] ?? "http://localhost:4317";
        var serviceName = builder.Environment.ApplicationName;
        var serviceVersion = Assembly.GetEntryAssembly()?.GetName().Version?.ToString() ?? "1.0.0";

        builder.Services.AddOpenTelemetry()
            .ConfigureResource(r => r
                .AddService(
                    serviceName: serviceName,
                    serviceVersion: serviceVersion,
                    serviceNamespace: "cinema-booking"))
            .WithTracing(t => t
                .AddSource("MassTransit")
                .AddSource("MongoDB.Driver.Core.Extensions.DiagnosticSources")
                .AddSource("Npgsql")
                .AddEntityFrameworkCoreInstrumentation()
                .AddRedisInstrumentation()
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
                .AddRuntimeInstrumentation()
                .AddProcessInstrumentation()
                .AddOtlpExporter(o => o.Endpoint = new Uri(otlpEndpoint)));

        builder.Logging.AddOpenTelemetry(logging =>
        {
            logging.IncludeScopes = true;
            logging.IncludeFormattedMessage = true;
            logging.AddOtlpExporter(o => o.Endpoint = new Uri(otlpEndpoint));
        });

        return builder;
    }
}
