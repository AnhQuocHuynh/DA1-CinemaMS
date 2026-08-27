using PaymentService.Application.Contracts;
using PaymentService.Application.DTOs;

namespace PaymentService.Infrastructure.Gateways;

/// <summary>
/// Cash payment gateway — no external API call.
/// Staff manually confirms the payment at the counter via POST /api/payments/cash/confirm.
/// </summary>
public class CashGateway : IPaymentGateway
{
    /// <summary>
    /// For CASH, we simply return a success result without a redirect URL.
    /// The caller (InitiatePaymentCommandHandler) handles CASH separately and
    /// never calls this gateway; but the interface must be satisfied.
    /// </summary>
    public Task<PaymentInitiationResult> InitiateAsync(PaymentRequest request)
    {
        // No external gateway call — just return a pending success
        return Task.FromResult(new PaymentInitiationResult(true, null, null));
    }

    /// <summary>
    /// Cash payments are confirmed via the admin endpoint, not via a callback/webhook.
    /// This method should never be called in normal flow.
    /// </summary>
    public Task<PaymentVerificationResult> VerifyCallbackAsync(IDictionary<string, string> parameters)
    {
        return Task.FromResult(new PaymentVerificationResult(
            false, null, null,
            "Cash payments are confirmed manually by admin, not via callback."));
    }

    /// <summary>
    /// Cash refunds are handled manually over the counter by the admin.
    /// Just return success to update the DB status.
    /// </summary>
    public Task<RefundResult> RefundAsync(string transactionId, decimal amount, string currency)
    {
        return Task.FromResult(new RefundResult(true, null));
    }
}
