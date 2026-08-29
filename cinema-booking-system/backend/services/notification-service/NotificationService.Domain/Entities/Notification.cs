using System;
using System.Collections.Generic;
using NotificationService.Domain.Enums;

namespace NotificationService.Domain.Entities;

public class Notification
{
    public string Id { get; private set; }
    public long UserId { get; private set; }
    public NotificationType Type { get; private set; }
    public NotificationChannel Channel { get; private set; }
    public string Title { get; private set; }
    public string Body { get; private set; }
    public Dictionary<string, object> Metadata { get; private set; }
    public DeliveryStatus Status { get; private set; }
    public int RetryCount { get; private set; }
    public DateTime? SentAt { get; private set; }
    public string? FailedReason { get; private set; }
    public DateTime CreatedAt { get; private set; }

    private Notification()
    {
        Id = string.Empty;
        Title = string.Empty;
        Body = string.Empty;
        Metadata = new Dictionary<string, object>();
    } // MongoDB

    public Notification(long userId, NotificationType type, NotificationChannel channel, string title, string body, Dictionary<string, object>? metadata = null)
    {
        if (userId <= 0) throw new ArgumentException("UserId must be greater than zero.", nameof(userId));
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Title is required.", nameof(title));
        if (string.IsNullOrWhiteSpace(body)) throw new ArgumentException("Body is required.", nameof(body));

        Id = string.Empty;
        UserId = userId;
        Type = type;
        Channel = channel;
        Title = title;
        Body = body;
        Metadata = metadata ?? new Dictionary<string, object>();
        Status = DeliveryStatus.PENDING;
        RetryCount = 0;
        CreatedAt = DateTime.UtcNow;
    }

    public void MarkAsSent()
    {
        Status = DeliveryStatus.SENT;
        SentAt = DateTime.UtcNow;
        FailedReason = null;
    }

    public void MarkAsFailed(string reason)
    {
        Status = DeliveryStatus.FAILED;
        FailedReason = reason;
    }

    public void MarkForRetry()
    {
        if (Status != DeliveryStatus.FAILED)
        {
            throw new InvalidOperationException("Only failed notifications can be marked for retry.");
        }
        Status = DeliveryStatus.PENDING;
    }

    public void IncrementRetry()
    {
        RetryCount++;
    }
}
