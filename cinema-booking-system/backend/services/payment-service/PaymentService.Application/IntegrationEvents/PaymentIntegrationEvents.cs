namespace PaymentService.Application.IntegrationEvents;

/// <summary>Published when a Payment record is created. Triggers the PaymentStateMachine into Pending state.</summary>
public record PaymentInitiated
{
    public Guid CorrelationId { get; init; }
    public long PaymentId { get; init; }
    public long OrderId { get; init; }
    public long UserId { get; init; }
    public decimal Amount { get; init; }
    public string Currency { get; init; } = "VND";
    public string PaymentMethod { get; init; } = string.Empty;
}

/// <summary>Published after gateway signature verification. Saga drives domain state + downstream events.</summary>
public record GatewayCallbackReceived
{
    public Guid CorrelationId { get; init; }
    public string PaymentMethod { get; init; } = string.Empty;
    public bool IsSuccess { get; init; }
    public string? TransactionId { get; init; }
    public string? ErrorMessage { get; init; }
    public string? RawResponse { get; init; }
}

/// <summary>Published when admin confirms a cash payment was collected at the counter.</summary>
public record CashPaymentConfirmed
{
    public Guid CorrelationId { get; init; }
    public long PaymentId { get; init; }
    public long AdminUserId { get; init; }
}

/// <summary>Published by the saga when payment transitions to COMPLETED. Consumed by Booking Service.</summary>
public record PaymentCompleted
{
    public Guid CorrelationId { get; init; }
    public long PaymentId { get; init; }
    public long OrderId { get; init; }
    public long UserId { get; init; }
    public decimal Amount { get; init; }
    public string TransactionId { get; init; } = string.Empty;
    public string PaymentMethod { get; init; } = string.Empty;
    public DateTime PaidAt { get; init; }
}

/// <summary>Published by the saga when payment transitions to FAILED. Consumed by Booking Service.</summary>
public record PaymentFailed
{
    public Guid CorrelationId { get; init; }
    public long PaymentId { get; init; }
    public long OrderId { get; init; }
    public long UserId { get; init; }
    public string Reason { get; init; } = string.Empty;
}

/// <summary>Published by the saga when a refund completes. Consumed by Booking Service.</summary>
public record PaymentRefunded
{
    public Guid CorrelationId { get; init; }
    public long PaymentId { get; init; }
    public long OrderId { get; init; }
    public long UserId { get; init; }
    public decimal RefundAmount { get; init; }
    public string Reason { get; init; } = string.Empty;
}

/// <summary>Published when a refund is requested, triggering the saga refund sub-flow.</summary>
public record RefundRequested
{
    public Guid CorrelationId { get; init; }
    public long PaymentId { get; init; }
    public decimal Amount { get; init; }
    public string Reason { get; init; } = string.Empty;
}

/// <summary>Inbound event from Booking Service (order.paid routing key).</summary>
public record OrderPaid
{
    public long OrderId { get; init; }
    public long UserId { get; init; }
    public long ShowtimeId { get; init; }
    public decimal TotalAmount { get; init; }
    public decimal FinalAmount { get; init; }
    public int TicketCount { get; init; }
    public string PaymentMethod { get; init; } = string.Empty;
    public string TransactionId { get; init; } = string.Empty;
}
