namespace PaymentService.Application.DTOs;

public record PaymentInitiationResult(bool IsSuccess, string? RedirectUrl, string? ErrorMessage);
