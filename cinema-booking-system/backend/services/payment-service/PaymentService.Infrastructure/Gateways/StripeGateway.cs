using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using PaymentService.Application.Contracts;
using PaymentService.Application.DTOs;
using PaymentService.Application.Exceptions;
using Stripe;
using Stripe.Checkout;

namespace PaymentService.Infrastructure.Gateways;

/// <summary>
/// Stripe Checkout Session gateway (test mode).
/// Docs: https://stripe.com/docs/payments/checkout
/// Test card: 4242 4242 4242 4242
/// </summary>
public class StripeGateway : IPaymentGateway
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<StripeGateway> _logger;

    // Key used in Stripe Checkout Session metadata to link back to our internal payment record
    private const string PAYMENT_ID_METADATA_KEY = "paymentId";

    public StripeGateway(IConfiguration configuration, ILogger<StripeGateway> logger)
    {
        _configuration = configuration;
        _logger = logger;

        StripeConfiguration.ApiKey = _configuration["Stripe:SecretKey"]
            ?? throw new InvalidOperationException("Stripe:SecretKey is not configured.");
    }

    public async Task<PaymentInitiationResult> InitiateAsync(PaymentRequest request)
    {
        try
        {
            var options = new SessionCreateOptions
            {
                PaymentMethodTypes = new List<string> { "card" },
                LineItems = new List<SessionLineItemOptions>
                {
                    new SessionLineItemOptions
                    {
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = request.Currency.ToLower(),
                            UnitAmount = ConvertToSmallestUnit(request.Amount, request.Currency),
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = "Cinema Ticket Booking",
                                Description = $"Payment for booking order"
                            }
                        },
                        Quantity = 1
                    }
                },
                Mode = "payment",
                SuccessUrl = request.SuccessUrl,
                CancelUrl = request.CancelUrl,
                Metadata = new Dictionary<string, string>
                {
                    { PAYMENT_ID_METADATA_KEY, request.PaymentId.ToString() }
                }
            };

            var service = new SessionService();
            var session = await service.CreateAsync(options);

            _logger.LogInformation("Stripe Checkout Session created: {SessionId} for PaymentId: {PaymentId}",
                session.Id, request.PaymentId);

            return new PaymentInitiationResult(true, session.Url, null);
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe API error while initiating payment {PaymentId}", request.PaymentId);
            return new PaymentInitiationResult(false, null, ex.StripeError?.Message ?? ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error initiating Stripe payment {PaymentId}", request.PaymentId);
            return new PaymentInitiationResult(false, null, ex.Message);
        }
    }

    public async Task<PaymentVerificationResult> VerifyCallbackAsync(IDictionary<string, string> parameters)
    {
        try
        {
            // 1. Direct session check (when redirected back with session_id)
            if (parameters.TryGetValue("sessionId", out var sessionId) && !string.IsNullOrWhiteSpace(sessionId))
            {
                var sessionService = new SessionService();
                var session = await sessionService.GetAsync(sessionId);

                if (session == null)
                    return new PaymentVerificationResult(false, null, null, "Stripe session not found");

                if (session.PaymentStatus == "paid")
                {
                    if (session.Metadata != null && session.Metadata.TryGetValue(PAYMENT_ID_METADATA_KEY, out var paymentIdStr))
                    {
                        parameters["paymentId"] = paymentIdStr;
                    }

                    var txnId = session.PaymentIntentId ?? session.Id;
                    return new PaymentVerificationResult(true, txnId, session.RawJObject?.ToString(), null);
                }

                return new PaymentVerificationResult(false, null, session.RawJObject?.ToString(), $"Stripe session payment status is {session.PaymentStatus}");
            }

            // 2. Webhook signature & event processing
            if (!parameters.TryGetValue("rawBody", out var rawBody))
                return new PaymentVerificationResult(false, null, null, "Missing raw request body");

            if (!parameters.TryGetValue("stripeSignature", out var signature))
                return new PaymentVerificationResult(false, null, null, "Missing Stripe-Signature header");

            var webhookSecret = _configuration["Stripe:WebhookSecret"]
                ?? throw new InvalidOperationException("Stripe:WebhookSecret is not configured.");

            Event stripeEvent;
            try
            {
                stripeEvent = EventUtility.ConstructEvent(rawBody, signature, webhookSecret);
            }
            catch (StripeException ex)
            {
                _logger.LogWarning("Stripe webhook signature validation failed: {Message}", ex.Message);
                var isDev = string.Equals(_configuration["ASPNETCORE_ENVIRONMENT"], "Development", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"), "Development", StringComparison.OrdinalIgnoreCase);

                if (isDev)
                {
                    _logger.LogWarning("Development mode: Falling back to EventUtility.ParseEvent without signature verification.");
                    try
                    {
                        stripeEvent = EventUtility.ParseEvent(rawBody, throwOnApiVersionMismatch: false);
                    }
                    catch (Exception parseEx)
                    {
                        _logger.LogWarning("Could not parse Stripe event JSON: {Message}", parseEx.Message);
                        return new PaymentVerificationResult(true, null, rawBody, null); // Acknowledge with 200 OK
                    }
                }
                else
                {
                    return new PaymentVerificationResult(false, null, null, "Invalid Stripe signature");
                }
            }

            _logger.LogInformation("Stripe webhook event received: {EventType}", stripeEvent.Type);

            if (stripeEvent.Type == EventTypes.CheckoutSessionCompleted)
            {
                var session = stripeEvent.Data.Object as Session;
                if (session == null)
                    return new PaymentVerificationResult(false, null, rawBody, "Invalid session data");

                // Extract paymentId from metadata (stored during InitiateAsync)
                if (!session.Metadata.TryGetValue(PAYMENT_ID_METADATA_KEY, out var paymentIdStr))
                    return new PaymentVerificationResult(false, null, rawBody, "paymentId not in session metadata");

                // The transaction ID from Stripe is the PaymentIntent ID
                var transactionId = session.PaymentIntentId;

                // Inject paymentId back into parameters for the handler to use
                parameters["paymentId"] = paymentIdStr;

                return new PaymentVerificationResult(true, transactionId, rawBody, null);
            }

            if (stripeEvent.Type == EventTypes.PaymentIntentPaymentFailed)
            {
                var paymentIntent = stripeEvent.Data.Object as PaymentIntent;
                var failureMessage = paymentIntent?.LastPaymentError?.Message ?? "Payment failed";

                // For failed events, paymentId may be in the metadata of the PaymentIntent
                if (paymentIntent?.Metadata?.TryGetValue(PAYMENT_ID_METADATA_KEY, out var paymentIdStr) == true)
                    parameters["paymentId"] = paymentIdStr;

                return new PaymentVerificationResult(false, null, rawBody, failureMessage);
            }

            // For other event types (e.g. payment_intent.created, charge.succeeded), acknowledge with IsSuccess = true so webhooks return 200 OK
            _logger.LogInformation("Stripe event {EventType} acknowledged (no action needed).", stripeEvent.Type);
            return new PaymentVerificationResult(true, null, rawBody, null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error verifying Stripe callback");
            return new PaymentVerificationResult(false, null, null, ex.Message);
        }
    }

    public async Task<RefundResult> RefundAsync(string transactionId, decimal amount, string currency)
    {
        try
        {
            var options = new RefundCreateOptions
            {
                PaymentIntent = transactionId,
                Amount = ConvertToSmallestUnit(amount, currency),
                Reason = RefundReasons.RequestedByCustomer
            };

            var service = new RefundService();
            var refund = await service.CreateAsync(options);

            if (refund.Status == "succeeded" || refund.Status == "pending")
            {
                _logger.LogInformation("Stripe refund created for transaction {TransactionId}", transactionId);
                return new RefundResult(true, null);
            }

            _logger.LogWarning("Stripe refund failed for transaction {TransactionId}. Status: {Status}", transactionId, refund.Status);
            return new RefundResult(false, $"Stripe refund status: {refund.Status}");
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe API error while refunding transaction {TransactionId}", transactionId);
            return new RefundResult(false, ex.StripeError?.Message ?? ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error refunding Stripe transaction {TransactionId}", transactionId);
            return new RefundResult(false, ex.Message);
        }
    }

    /// <summary>
    /// Stripe requires amounts in the smallest currency unit.
    /// VND is a zero-decimal currency, USD uses cents.
    /// For simplicity in test mode, we treat VND as USD cents (divide by 100).
    /// </summary>
    private static long ConvertToSmallestUnit(decimal amount, string currency)
    {
        // Zero-decimal currencies (like VND) don't need multiplication
        var zeroDecimal = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "VND", "JPY", "KRW" };
        return zeroDecimal.Contains(currency)
            ? (long)amount
            : (long)(amount * 100);
    }
}
