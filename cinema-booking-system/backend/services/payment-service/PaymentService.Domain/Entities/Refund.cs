using System;
using PaymentService.Domain.Enums;

namespace PaymentService.Domain.Entities;

public class Refund
{
    public long Id { get; private set; }
    public long PaymentId { get; private set; }
    public decimal Amount { get; private set; }
    public string Reason { get; private set; } = string.Empty;
    public RefundStatus Status { get; private set; } = RefundStatus.PENDING;
    public DateTime? ProcessedAt { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    protected Refund() { } // EF Core

    internal Refund(long paymentId, decimal amount, string reason)
    {
        PaymentId = paymentId;
        Amount = amount;
        Reason = reason;
        Status = RefundStatus.PENDING;
        CreatedAt = DateTime.UtcNow;
    }

    public void Approve()
    {
        if (Status != RefundStatus.PENDING)
            throw new InvalidOperationException("Only pending refunds can be approved.");

        Status = RefundStatus.APPROVED;
    }

    public void Process()
    {
        if (Status != RefundStatus.APPROVED && Status != RefundStatus.PENDING)
            throw new InvalidOperationException("Only pending or approved refunds can be processed.");

        Status = RefundStatus.PROCESSED;
        ProcessedAt = DateTime.UtcNow;
    }

    public void Reject()
    {
        if (Status != RefundStatus.PENDING)
            throw new InvalidOperationException("Only pending refunds can be rejected.");

        Status = RefundStatus.REJECTED;
        ProcessedAt = DateTime.UtcNow;
    }
}
