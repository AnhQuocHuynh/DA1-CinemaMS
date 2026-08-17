using System.Net;
using System.Text.Json;
using FluentValidation;
using PaymentService.Application.Exceptions;

namespace PaymentService.Presentation.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        HttpStatusCode code;
        object result;

        switch (exception)
        {
            case ValidationException validationEx:
                code = HttpStatusCode.BadRequest;
                result = new
                {
                    error = "Validation failed",
                    details = validationEx.Errors.Select(e => e.ErrorMessage)
                };
                break;

            case PaymentNotFoundException notFoundEx:
                code = HttpStatusCode.NotFound;
                result = new { error = notFoundEx.Message };
                break;

            case InvalidPaymentStateException stateEx:
                code = HttpStatusCode.Conflict;
                result = new { error = stateEx.Message };
                break;

            case DuplicateTransactionException dupEx:
                code = HttpStatusCode.Conflict;
                result = new { error = dupEx.Message };
                break;

            case PaymentGatewayException gatewayEx:
                code = HttpStatusCode.BadGateway;
                result = new { error = "Payment gateway error", details = gatewayEx.Message };
                break;

            case UnauthorizedAccessException:
                code = HttpStatusCode.Unauthorized;
                result = new { error = "Unauthorized" };
                break;

            default:
                code = HttpStatusCode.InternalServerError;
                result = new { error = "An internal server error occurred." };
                break;
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)code;

        return context.Response.WriteAsync(JsonSerializer.Serialize(result, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        }));
    }
}
