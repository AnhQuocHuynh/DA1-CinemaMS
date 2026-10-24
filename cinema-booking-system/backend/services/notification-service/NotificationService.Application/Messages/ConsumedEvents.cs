using System;

namespace NotificationService.Application.Messages;

public record KeycloakUserRegisteredPayload(string KeycloakId, string Email, string FullName, string? PhoneNumber);
public record UserProfileUpdatedPayload(long UserId, string Email, string FullName, string? PhoneNumber);
public record KeycloakPasswordResetPayload(string KeycloakId, string Email, string ResetToken);

public record OrderPaidPayload(
    long OrderId, long UserId, long ShowtimeId,
    long? MovieId, long? EventId,
    decimal TotalAmount, decimal FinalAmount,
    int TicketCount, string? PaymentMethod = null, string? TransactionId = null);

public record OrderRefundedPayload(
    long OrderId, long UserId, long ShowtimeId,
    decimal FinalAmount, int TicketCount);

public record ReviewCreatedPayload(
    long ReviewId, long UserId, long? MovieId, long? EventId,
    int? Rating, string? Status, DateTime? CreatedAt);

public record ShowtimeCreatedPayload(long ShowtimeId, long? MovieId, string? MovieTitle, DateTime? StartTime);
