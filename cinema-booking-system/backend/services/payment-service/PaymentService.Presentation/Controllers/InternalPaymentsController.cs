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
    public InternalPaymentsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /internal/payments/order/{orderId}/status
    // Returns payment status for Booking Service after payment.completed event
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("order/{orderId:long}/status")]
    public async Task<IActionResult> GetPaymentStatus(long orderId)
    {
        var status = await _mediator.Send(new GetPaymentStatusInternalQuery(orderId));
        return Ok(ApiResponse<object>.Ok(new { orderId, status = status.ToString() }));
    }
}
