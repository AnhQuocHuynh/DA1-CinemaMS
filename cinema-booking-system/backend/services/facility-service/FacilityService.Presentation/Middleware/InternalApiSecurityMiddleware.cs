using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using System.Text.Json;
using System.Threading.Tasks;

namespace FacilityService.Presentation.Middleware;

public class InternalApiSecurityMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _configuration;
    private const string InternalPrefix = "/internal/";
    private const string TokenHeader = "X-Internal-Token";

    public InternalApiSecurityMiddleware(RequestDelegate next, IConfiguration configuration)
    {
        _next = next;
        _configuration = configuration;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments(InternalPrefix, System.StringComparison.OrdinalIgnoreCase))
        {
            await _next(context);
            return;
        }

        var configuredToken = _configuration["InternalApi:Token"];
        if (string.IsNullOrWhiteSpace(configuredToken))
        {
            // If token is not configured, block to be safe
            await WriteUnauthorizedResponse(context, "Internal API token is not configured.");
            return;
        }

        if (!context.Request.Headers.TryGetValue(TokenHeader, out var providedToken) || 
            providedToken != configuredToken)
        {
            await WriteUnauthorizedResponse(context, "Invalid internal token");
            return;
        }

        await _next(context);
    }

    private static async Task WriteUnauthorizedResponse(HttpContext context, string message)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        context.Response.ContentType = "application/json";
        
        var errorResponse = new
        {
            success = false,
            errorCode = "INTERNAL_TOKEN_INVALID",
            message = message
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(errorResponse));
    }
}
