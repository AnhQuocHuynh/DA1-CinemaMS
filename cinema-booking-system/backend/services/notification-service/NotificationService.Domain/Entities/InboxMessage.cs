using System;
using NotificationService.Domain.Enums;

namespace NotificationService.Domain.Entities;

public class InboxMessage
{
    public string Id { get; private set; }
    public string MessageId { get; private set; }
    public string ConsumerName { get; private set; }
    public string EventType { get; private set; }
    public InboxStatus Status { get; private set; }
    public DateTime ReceivedAt { get; private set; }
    public DateTime? ProcessedAt { get; private set; }
    public string? ErrorMessage { get; private set; }

    private InboxMessage()
    {
        Id = Guid.NewGuid().ToString();
        MessageId = string.Empty;
        ConsumerName = string.Empty;
        EventType = string.Empty;
    }

    public InboxMessage(string messageId, string consumerName, string eventType)
    {
        if (string.IsNullOrWhiteSpace(messageId))
            throw new ArgumentException("MessageId is required.", nameof(messageId));
        if (string.IsNullOrWhiteSpace(consumerName))
            throw new ArgumentException("ConsumerName is required.", nameof(consumerName));

        Id = Guid.NewGuid().ToString();
        MessageId = messageId;
        ConsumerName = consumerName;
        EventType = eventType ?? string.Empty;
        Status = InboxStatus.Processing;
        ReceivedAt = DateTime.UtcNow;
    }

    public void MarkProcessed()
    {
        Status = InboxStatus.Processed;
        ProcessedAt = DateTime.UtcNow;
        ErrorMessage = null;
    }

    public void MarkFailed(string errorMessage)
    {
        Status = InboxStatus.Failed;
        ErrorMessage = errorMessage;
    }
}
