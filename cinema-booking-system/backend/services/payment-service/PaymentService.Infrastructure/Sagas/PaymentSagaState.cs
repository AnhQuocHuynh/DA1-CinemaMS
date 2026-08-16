using MassTransit;

namespace PaymentService.Infrastructure.Sagas;

/// <summary>
/// EF Core-persisted state for the Payment Saga.
/// One row per payment — tracks state machine progress.
/// </summary>
public class PaymentSagaState : SagaStateMachineInstance, ISagaVersion
{
    /// <summary>MassTransit saga correlation key. Equals Payment.SagaId.</summary>
    public Guid CorrelationId { get; set; }

    /// <summary>Optimistic concurrency row version (required by EF Core saga repository).</summary>
    public int Version { get; set; }

    /// <summary>Current state name: Initial | Pending | Completed | Failed | Refunded.</summary>
    public string CurrentState { get; set; } = string.Empty;

    // ── Denormalized payment info (kept on saga for event publishing without a DB join) ──
    public long PaymentId { get; set; }
    public long OrderId { get; set; }
    public long UserId { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "VND";
    public string PaymentMethod { get; set; } = string.Empty;
    public string? TransactionId { get; set; }
    public string? FailureReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
}
