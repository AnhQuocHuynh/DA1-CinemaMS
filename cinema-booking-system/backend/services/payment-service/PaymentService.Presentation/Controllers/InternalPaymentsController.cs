using MediatR;
using Microsoft.AspNetCore.Mvc;
using PaymentService.Application.Features.Payments.Queries;
using PaymentService.Domain.Enums;
using PaymentService.Presentation.Models;

namespace PaymentService.Presentation.Controllers;

/// <summary>
/// Internal-only endpoints — blocked at the API Gateway level.
/// Authenticated via X-Internal-Api-Key header.
/// Used by Booking Service to check payment status.
/// </summary>
[ApiController]
[Route("internal/payments")]
public class InternalPaymentsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IConfiguration _configuration;

    public InternalPaymentsController(IMediator mediator, IConfiguration configuration)
    {
        _mediator = mediator;
        _configuration = configuration;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /internal/payments/order/{orderId}/status
    // Returns payment status for Booking Service after payment.completed event
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("order/{orderId:long}/status")]
    public async Task<IActionResult> GetPaymentStatus(long orderId)
    {
        // Validate internal API key
        if (!ValidateInternalApiKey())
            return Unauthorized(new { error = "Invalid or missing X-Internal-Api-Key" });

        var status = await _mediator.Send(new GetPaymentStatusInternalQuery(orderId));
        return Ok(ApiResponse<object>.Ok(new { orderId, status = status.ToString() }));
    }

    private bool ValidateInternalApiKey()
    {
        var expectedKey = _configuration["InternalApi:Key"];
        if (string.IsNullOrEmpty(expectedKey))
            return true; // Key not configured — allow in development

        Request.Headers.TryGetValue("X-Internal-Api-Key", out var receivedKey);
        return receivedKey.ToString() == expectedKey;
    }
}
