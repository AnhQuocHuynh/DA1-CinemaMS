using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PaymentService.Application.DTOs;
using PaymentService.Application.Features.Payments.Commands;
using PaymentService.Application.Features.Payments.Queries;
using PaymentService.Domain.Enums;
using PaymentService.Presentation.Models;
using System.Security.Claims;

namespace PaymentService.Presentation.Controllers;

[ApiController]
[Route("api/payments")]
public class PaymentsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IConfiguration _configuration;

    public PaymentsController(IMediator mediator, IConfiguration configuration)
    {
        _mediator = mediator;
        _configuration = configuration;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/payments/initiate
    // Phase 3 of the Booking Saga — create payment & redirect to gateway
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("initiate")]
    [Authorize]
    public async Task<IActionResult> InitiatePayment([FromBody] InitiatePaymentRequest request)
    {
        var userId = GetCurrentUserId();
        var baseUrl = _configuration["App:BaseUrl"] ?? "http://localhost:3000";

        var command = new InitiatePaymentCommand(
            OrderId: request.OrderId,
            UserId: userId,
            Amount: request.Amount,
            Currency: request.Currency ?? "VND",
            PaymentMethod: request.PaymentMethod,
            CancelUrl: request.CancelUrl ?? $"{baseUrl}/checkout-canceled?orderId={request.OrderId}",
            SuccessUrl: request.SuccessUrl ?? $"{baseUrl}/checkout-success?orderId={request.OrderId}"
        );

        var result = await _mediator.Send(command);

        if (!result.IsSuccess)
            return BadRequest(ApiResponse<object>.Error(result.ErrorMessage ?? "Payment initiation failed"));

        if (request.PaymentMethod == PaymentMethod.CASH)
            return Ok(ApiResponse<object>.Ok(new { status = "AWAITING_CASH", orderId = request.OrderId },
                "Cash payment pending counter confirmation"));

        return Ok(ApiResponse<object>.Ok(new { checkoutUrl = result.RedirectUrl }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/payments/callback/stripe
    // Phase 4 — Stripe webhook. No auth (webhook from Stripe). Raw body required.
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("callback/stripe")]
    [AllowAnonymous]
    public async Task<IActionResult> StripeCallback()
    {
        // Read raw body for signature verification (must not use buffered body)
        Request.EnableBuffering();
        using var reader = new StreamReader(Request.Body, leaveOpen: true);
        var rawBody = await reader.ReadToEndAsync();
        Request.Body.Position = 0;

        var stripeSignature = Request.Headers["Stripe-Signature"].ToString();

        var parameters = new Dictionary<string, string>
        {
            { "rawBody", rawBody },
            { "stripeSignature", stripeSignature }
        };

        var command = new HandlePaymentCallbackCommand(PaymentMethod.STRIPE, parameters);
        await _mediator.Send(command);

        // Always return 200 to Stripe (they retry on non-2xx)
        return Ok();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/payments/callback/paypal/return?token=ORDER_ID&PayerID=...
    // Phase 4 — PayPal redirect return URL after user approves payment
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("callback/paypal/return")]
    [AllowAnonymous]
    public async Task<IActionResult> PayPalReturn([FromBody] PayPalReturnRequest request)
    {
        var parameters = new Dictionary<string, string>
        {
            { "token", request.Token }
        };
        if (!string.IsNullOrEmpty(request.PayerID))
            parameters["PayerID"] = request.PayerID;

        var command = new HandlePaymentCallbackCommand(PaymentMethod.PAYPAL, parameters);
        var success = await _mediator.Send(command);

        if (!success)
            return BadRequest(ApiResponse<object>.Error("Failed to capture PayPal payment."));

        return Ok(ApiResponse<object>.Ok(null, "PayPal payment captured successfully."));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POST /api/payments/cash/confirm   (ADMIN only)
    // Confirms cash payment collected at cinema counter
    // ─────────────────────────────────────────────────────────────────────────
    [HttpPost("cash/confirm")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> ConfirmCashPayment([FromBody] ConfirmCashRequest request)
    {
        var adminUserId = GetCurrentUserId();
        var command = new ConfirmCashPaymentCommand(request.PaymentId, adminUserId);
        var result = await _mediator.Send(command);
        return Ok(ApiResponse<PaymentDto>.Ok(result, "Cash payment confirmed successfully"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/payments/order/{orderId}
    // Get payment by order ID (used by frontend polling after checkout redirect)
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("order/{orderId:long}")]
    [Authorize]
    public async Task<IActionResult> GetByOrderId(long orderId)
    {
        var payment = await _mediator.Send(new GetPaymentByOrderIdQuery(orderId));
        return Ok(ApiResponse<PaymentDto>.Ok(payment));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/payments/order/{orderId}/status
    // Lightweight status polling endpoint (returns just the status string)
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("order/{orderId:long}/status")]
    [Authorize]
    public async Task<IActionResult> GetStatusByOrderId(long orderId)
    {
        var payment = await _mediator.Send(new GetPaymentByOrderIdQuery(orderId));
        return Ok(ApiResponse<object>.Ok(new { status = payment.Status.ToString(), paymentId = payment.Id }));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/payments/{id}
    // Get payment by payment ID
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("{id:long}")]
    [Authorize]
    public async Task<IActionResult> GetById(long id)
    {
        var payment = await _mediator.Send(new GetPaymentByIdQuery(id));
        return Ok(ApiResponse<PaymentDto>.Ok(payment));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/payments/me
    // User's own payment history
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetMyPayments()
    {
        var userId = GetCurrentUserId();
        var payments = await _mediator.Send(new GetPaymentsByUserQuery(userId));
        return Ok(ApiResponse<IEnumerable<PaymentDto>>.Ok(payments));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET /api/payments?page=1&pageSize=20   (ADMIN)
    // Paginated payment list for admin dashboard
    // ─────────────────────────────────────────────────────────────────────────
    [HttpGet]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> GetAllPayments([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await _mediator.Send(new GetPaymentsQuery(page, pageSize));
        return Ok(ApiResponse<object>.Ok(result));
    }

    // ─────────────────────────────────────────────────────────────────────────
    private long GetCurrentUserId()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (long.TryParse(userIdClaim, out var userId))
            return userId;
        throw new UnauthorizedAccessException("X-User-Id header is missing or invalid.");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request DTOs (Presentation-layer only)
// ─────────────────────────────────────────────────────────────────────────────
public record InitiatePaymentRequest(
    long OrderId,
    decimal Amount,
    PaymentMethod PaymentMethod,
    string? Currency = "VND",
    string? CancelUrl = null,
    string? SuccessUrl = null
);

public record ConfirmCashRequest(long PaymentId);
public record PayPalReturnRequest(string Token, string? PayerID);
