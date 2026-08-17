using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PaymentService.Application.DTOs;
using PaymentService.Application.Features.Refunds.Commands;
using PaymentService.Presentation.Models;
using System.Security.Claims;

namespace PaymentService.Presentation.Controllers;

[ApiController]
[Route("api/payments")]
public class RefundsController : ControllerBase
{
    private readonly IMediator _mediator;

    public RefundsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/payments/{id}/refund
    // User requests a refund for a completed payment
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("{id:long}/refund")]
    [Authorize]
    public async Task<IActionResult> RequestRefund(long id, [FromBody] RequestRefundRequest request)
    {
        var command = new RequestRefundCommand(id, request.Amount, request.Reason);
        var refund = await _mediator.Send(command);
        return Accepted(ApiResponse<RefundDto>.Ok(refund, "Refund request submitted and pending admin approval"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUT /api/payments/refunds/{refundId}   (ADMIN)
    // Admin approves or rejects a pending refund
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPut("refunds/{refundId:long}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> ProcessRefund(long refundId, [FromBody] ProcessRefundRequest request)
    {
        var command = new ProcessRefundCommand(refundId, request.Approve);
        await _mediator.Send(command);

        var message = request.Approve ? "Refund approved and processed" : "Refund rejected";
        return Ok(ApiResponse<object>.Ok(new { refundId, approved = request.Approve }, message));
    }

    private long GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (long.TryParse(userIdClaim, out var userId))
            return userId;
        throw new UnauthorizedAccessException("X-User-Id header is missing or invalid.");
    }
}

// Request DTOs
public record RequestRefundRequest(decimal Amount, string Reason);
public record ProcessRefundRequest(bool Approve);
