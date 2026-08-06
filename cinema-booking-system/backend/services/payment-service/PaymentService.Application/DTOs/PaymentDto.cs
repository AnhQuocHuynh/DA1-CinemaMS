using System;
using System.Collections.Generic;
using PaymentService.Domain.Enums;

namespace PaymentService.Application.DTOs;

public record RefundDto(
    long Id,
    long PaymentId,
    decimal Amount,
    string Reason,
    RefundStatus Status,
    DateTime? ProcessedAt,
    DateTime CreatedAt
);

public record PaymentDto(
    long Id,
    long OrderId,
    long UserId,
    string? TransactionId,
    decimal Amount,
    string Currency,
    PaymentMethod PaymentMethod,
    PaymentStatus Status,
    DateTime? PaidAt,
    DateTime CreatedAt,
    IEnumerable<RefundDto> Refunds
);
