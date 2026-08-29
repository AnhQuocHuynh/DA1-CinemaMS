package com.cinema.keycloak.events;

import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventType;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.events.admin.OperationType;
import org.keycloak.events.admin.ResourceType;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.UserModel;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.time.Instant;

public class RabbitMqEventListenerProvider implements EventListenerProvider {

    private final KeycloakSession session;
    private final RabbitMqPublisher publisher;

    public RabbitMqEventListenerProvider(KeycloakSession session, RabbitMqPublisher publisher) {
        this.session = session;
        this.publisher = publisher;
    }

    private void publishWithEnvelope(String eventType, String routingKey, Map<String, Object> payload) {
        Map<String, Object> envelope = new HashMap<>();
        envelope.put("EventId", UUID.randomUUID().toString());
        envelope.put("EventType", eventType);
        envelope.put("OccurredAt", Instant.now().toString());
        envelope.put("SchemaVersion", 1);
        envelope.put("Source", "Keycloak");
        envelope.put("Payload", payload);
        
        publisher.publish("user.events", routingKey, envelope);
    }

    @Override
    public void onEvent(Event event) {
        if (event.getType() == EventType.REGISTER) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("KeycloakId", event.getUserId());
            payload.put("Email", event.getDetails().get("email"));
            
            String firstName = event.getDetails().get("first_name") != null ? event.getDetails().get("first_name") : "";
            String lastName = event.getDetails().get("last_name") != null ? event.getDetails().get("last_name") : "";
            payload.put("FirstName", firstName);
            payload.put("LastName", lastName);
            payload.put("FullName", (firstName + " " + lastName).trim());
            
            // Custom attributes are prefixed with 'custom_attributes.' in the event details
            String phone = event.getDetails().get("custom_attributes.phone");
            payload.put("Phone", phone);
            payload.put("PhoneNumber", phone);
            
            payload.put("Gender", event.getDetails().get("custom_attributes.gender"));
            payload.put("DateOfBirth", event.getDetails().get("custom_attributes.date_of_birth"));

            publishWithEnvelope("KeycloakUserRegistered", "user.registered", payload);
        } else if (event.getType() == EventType.DELETE_ACCOUNT) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("KeycloakId", event.getUserId());
            publishWithEnvelope("KeycloakUserDeleted", "user.deleted", payload);
        }
    }

    @Override
    public void onEvent(AdminEvent adminEvent, boolean includeRepresentation) {
        if (adminEvent.getResourceType() == ResourceType.USER) {
            String resourcePath = adminEvent.getResourcePath(); // e.g., "users/1234-5678..."
            String userId = resourcePath != null && resourcePath.startsWith("users/") ? resourcePath.substring(6) : resourcePath;
            
            if (adminEvent.getOperationType() == OperationType.CREATE && userId != null) {
                UserModel user = session.users().getUserById(session.getContext().getRealm(), userId);
                if (user != null) {
                    Map<String, Object> payload = new HashMap<>();
                    payload.put("KeycloakId", userId);
                    payload.put("Email", user.getEmail());
                    
                    String firstName = user.getFirstName() != null ? user.getFirstName() : "";
                    String lastName = user.getLastName() != null ? user.getLastName() : "";
                    payload.put("FirstName", firstName);
                    payload.put("LastName", lastName);
                    payload.put("FullName", (firstName + " " + lastName).trim());
                    
                    String phone = user.getFirstAttribute("phone");
                    payload.put("Phone", phone);
                    payload.put("PhoneNumber", phone);
                    
                    payload.put("Gender", user.getFirstAttribute("gender"));
                    payload.put("DateOfBirth", user.getFirstAttribute("date_of_birth"));
                    
                    publishWithEnvelope("KeycloakUserRegistered", "user.registered", payload);
                }
            } else if (adminEvent.getOperationType() == OperationType.DELETE && userId != null) {
                Map<String, Object> payload = new HashMap<>();
                payload.put("KeycloakId", userId);
                publishWithEnvelope("KeycloakUserDeleted", "user.deleted", payload);
            }
        }
    }

    @Override
    public void close() { }
}
