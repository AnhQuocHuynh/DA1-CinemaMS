using System;

namespace NotificationService.Application.Messages;

public record KeycloakUserRegisteredPayload(string KeycloakId, string Email, string FullName, string? PhoneNumber);
public record UserProfileUpdatedPayload(long UserId, string Email, string FullName, string? PhoneNumber);
public record KeycloakPasswordResetPayload(string KeycloakId, string Email, string ResetToken);

public record OrderPaidPayload(
    long OrderId, long UserId, long ShowtimeId,
    decimal TotalAmount, decimal FinalAmount,
    int TicketCount, string PaymentMethod, string TransactionId);

public record OrderRefundedPayload(long OrderId, long UserId, decimal RefundAmount, string Reason);
public record ShowtimeCreatedPayload(long ShowtimeId, long MovieId, string MovieTitle, DateTime StartTime);
