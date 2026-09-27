using System;

namespace PaymentService.Application.Contracts
{
    public class EventEnvelope<T>
    {
        public Guid EventId { get; set; } = Guid.NewGuid();
        public string EventType { get; set; } = string.Empty;
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
        public int SchemaVersion { get; set; } = 1;
        public string Source { get; set; } = string.Empty;
        public T Payload { get; set; } = default!;
    }
}
