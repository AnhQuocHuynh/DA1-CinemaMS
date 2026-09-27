namespace PaymentService.Application.Messages;

public record PaymentCompletedPayload(long PaymentId, long OrderId, long UserId, decimal Amount, string TransactionId, string PaymentMethod);

public record PaymentFailedPayload(long PaymentId, long OrderId, long UserId, string Reason);

public record PaymentRefundedPayload(long PaymentId, long OrderId, long UserId, decimal RefundAmount, string Reason);

public record OrderPaidPayload(long OrderId, long UserId, long ShowtimeId, decimal TotalAmount, decimal FinalAmount, int TicketCount, string PaymentMethod, string TransactionId);
