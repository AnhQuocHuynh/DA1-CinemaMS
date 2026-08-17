using System;
using System.Collections.Generic;
using System.Linq;
using PaymentService.Domain.Enums;

namespace PaymentService.Domain.Entities;

public class Payment
{
    public long Id { get; private set; }
    public Guid SagaId { get; private set; }  // MassTransit saga correlation key
    public long OrderId { get; private set; }
    public long UserId { get; private set; }
    public string? TransactionId { get; private set; }
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = "VND";
    public PaymentMethod PaymentMethod { get; private set; }
    public PaymentStatus Status { get; private set; } = PaymentStatus.PENDING;
    public string? GatewayResponse { get; private set; }
    public DateTime? PaidAt { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; private set; }

    private readonly List<Refund> _refunds = new();
    public IReadOnlyCollection<Refund> Refunds => _refunds.AsReadOnly();

    protected Payment() { } // EF Core

    public Payment(long orderId, long userId, decimal amount, string currency, PaymentMethod paymentMethod)
    {
        SagaId = Guid.NewGuid();  // Generate saga correlation key
        OrderId = orderId;
        UserId = userId;
        Amount = amount;
        Currency = currency;
        PaymentMethod = paymentMethod;
        Status = PaymentStatus.PENDING;
        CreatedAt = DateTime.UtcNow;
    }

    public void Complete(string transactionId, string? gatewayResponse)
    {
        if (Status == PaymentStatus.COMPLETED)
            return; // Idempotent

        if (Status != PaymentStatus.PENDING)
            throw new InvalidOperationException($"Cannot complete payment in status {Status}");

        TransactionId = transactionId;
        GatewayResponse = gatewayResponse;
        Status = PaymentStatus.COMPLETED;
        PaidAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Fail(string? gatewayResponse)
    {
        if (Status != PaymentStatus.PENDING)
            throw new InvalidOperationException($"Cannot fail payment in status {Status}");

        GatewayResponse = gatewayResponse;
        Status = PaymentStatus.FAILED;
        UpdatedAt = DateTime.UtcNow;
    }

    public Refund AddRefund(decimal amount, string reason)
    {
        if (Status != PaymentStatus.COMPLETED && Status != PaymentStatus.PARTIALLY_REFUNDED)
            throw new InvalidOperationException("Can only refund completed payments.");

        decimal totalRefunded = _refunds
            .Where(r => r.Status == RefundStatus.APPROVED || r.Status == RefundStatus.PROCESSED)
            .Sum(r => r.Amount);

        if (totalRefunded + amount > Amount)
            throw new InvalidOperationException("Refund amount exceeds payment amount.");

        var refund = new Refund(Id, amount, reason);
        _refunds.Add(refund);
        
        UpdatedAt = DateTime.UtcNow;
        return refund;
    }

    public void MarkAsRefunded()
    {
        decimal totalRefunded = _refunds
            .Where(r => r.Status == RefundStatus.PROCESSED)
            .Sum(r => r.Amount);

        if (totalRefunded >= Amount)
        {
            Status = PaymentStatus.REFUNDED;
        }
        else if (totalRefunded > 0)
        {
            Status = PaymentStatus.PARTIALLY_REFUNDED;
        }
        
        UpdatedAt = DateTime.UtcNow;
    }
}
