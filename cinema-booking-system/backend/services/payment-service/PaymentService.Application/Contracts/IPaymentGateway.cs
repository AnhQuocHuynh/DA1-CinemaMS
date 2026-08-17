using System.Collections.Generic;
using System.Threading.Tasks;
using PaymentService.Application.DTOs;

namespace PaymentService.Application.Contracts;

public interface IPaymentGateway
{
    Task<PaymentInitiationResult> InitiateAsync(PaymentRequest request);
    Task<PaymentVerificationResult> VerifyCallbackAsync(IDictionary<string, string> parameters);
}

public record PaymentRequest(long PaymentId, decimal Amount, string Currency, string CancelUrl, string SuccessUrl);
public record PaymentVerificationResult(bool IsSuccess, string? TransactionId, string? RawResponse, string? ErrorMessage);
