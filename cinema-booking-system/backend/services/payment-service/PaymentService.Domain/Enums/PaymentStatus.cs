namespace PaymentService.Domain.Enums;

public enum PaymentStatus
{
    CREATED,
    PENDING,
    COMPLETED,
    FAILED,
    REFUNDED,
    PARTIALLY_REFUNDED,
    EXPIRED
}
