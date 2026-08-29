using System;
using NotificationService.Domain.Enums;

namespace NotificationService.Domain.Entities;

public class DeliveryLog
{
    public string Id { get; private set; }
    public string NotificationId { get; private set; }
    public int Attempt { get; private set; }
    public DeliveryStatus Status { get; private set; }
    public string? ProviderResponse { get; private set; }
    public DateTime Timestamp { get; private set; }

    private DeliveryLog()
    {
        Id = string.Empty;
        NotificationId = string.Empty;
    }

    public DeliveryLog(string notificationId, int attempt, DeliveryStatus status, string? providerResponse)
    {
        if (string.IsNullOrWhiteSpace(notificationId)) throw new ArgumentException("NotificationId is required.", nameof(notificationId));

        Id = string.Empty;
        NotificationId = notificationId;
        Attempt = attempt;
        Status = status;
        ProviderResponse = providerResponse;
        Timestamp = DateTime.UtcNow;
    }
}
