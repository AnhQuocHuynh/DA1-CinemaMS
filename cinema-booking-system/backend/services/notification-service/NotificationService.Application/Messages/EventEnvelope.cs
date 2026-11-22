using System;

namespace NotificationService.Application.Messages;

public interface IEventEnvelope
{
    Guid EventId { get; }
    string EventType { get; }
    DateTime OccurredAt { get; }
    int SchemaVersion { get; }
    string Source { get; }
}

public class EventEnvelope<T> : IEventEnvelope
{
    public Guid EventId { get; set; } = Guid.NewGuid();
    public string EventType { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public int SchemaVersion { get; set; } = 1;
    public string Source { get; set; } = string.Empty;
    public T Payload { get; set; } = default!;
}
