using System;

namespace FacilityService.Application.Messages;

/// <summary>
/// This represents the generic wrapper that ALL microservices expect.
/// Think of this like the "envelope" in the mail.
/// By standardizing this, other services (like the Spring Boot Analytics Service) 
/// can easily parse the eventId, timestamp, and type without guessing.
/// </summary>
public class IntegrationEvent<T>
{
    // A unique ID for tracing this specific message across services (Distributed Tracing)
    public Guid EventId { get; set; } = Guid.NewGuid();
    
    // The type of event, e.g., "facility.cinema.created"
    public string EventType { get; set; } = string.Empty;
    
    // Exactly when the event occurred in UTC time
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    
    // The actual data (the "letter" inside the envelope)
    public T Payload { get; set; } = default!;

    public IntegrationEvent(string eventType, T payload)
    {
        EventType = eventType;
        Payload = payload;
    }
}

/// <summary>
/// This is a specific payload. We use C# 9+ 'record' because events should be IMMUTABLE.
/// Once an event happens in the past, its details cannot be changed!
/// </summary>
public record CinemaCreatedPayload(
    int CinemaId,
    string Name,
    string Location
);

/// <summary>
/// Another example payload for when a room is added to a cinema.
/// </summary>
public record RoomAddedPayload(
    int RoomId,
    int CinemaId,
    string RoomName,
    int TotalSeats
);

// Example usage in an Application layer Command Handler:
//
// var payload = new CinemaCreatedPayload(1, "CGV Aeon Mall", "HCMC");
// var cinemaEvent = new IntegrationEvent<CinemaCreatedPayload>("facility.cinema.created", payload);
//
// await _eventPublisher.PublishAsync(
//      topic: "facility.events", 
//      routingKey: "cinema.created", 
//      message: cinemaEvent);
