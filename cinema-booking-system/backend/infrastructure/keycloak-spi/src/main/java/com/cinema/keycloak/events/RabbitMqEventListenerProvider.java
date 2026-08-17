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

public class RabbitMqEventListenerProvider implements EventListenerProvider {

    private final KeycloakSession session;
    private final RabbitMqPublisher publisher;

    public RabbitMqEventListenerProvider(KeycloakSession session, RabbitMqPublisher publisher) {
        this.session = session;
        this.publisher = publisher;
    }

    @Override
    public void onEvent(Event event) {
        if (event.getType() == EventType.REGISTER) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("KeycloakId", event.getUserId());
            payload.put("Email", event.getDetails().get("email"));
            payload.put("FirstName", event.getDetails().get("first_name"));
            payload.put("LastName", event.getDetails().get("last_name"));
            
            // Custom attributes are prefixed with 'custom_attributes.' in the event details
            payload.put("Phone", event.getDetails().get("custom_attributes.phone"));
            payload.put("Gender", event.getDetails().get("custom_attributes.gender"));
            payload.put("DateOfBirth", event.getDetails().get("custom_attributes.date_of_birth"));

            publisher.publish("user.events", "user.registered", payload);
        } else if (event.getType() == EventType.DELETE_ACCOUNT) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("KeycloakId", event.getUserId());
            publisher.publish("user.events", "user.deleted", payload);
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
                    payload.put("FirstName", user.getFirstName());
                    payload.put("LastName", user.getLastName());
                    
                    payload.put("Phone", user.getFirstAttribute("phone"));
                    payload.put("Gender", user.getFirstAttribute("gender"));
                    payload.put("DateOfBirth", user.getFirstAttribute("date_of_birth"));
                    
                    publisher.publish("user.events", "user.registered", payload);
                }
            } else if (adminEvent.getOperationType() == OperationType.DELETE && userId != null) {
                Map<String, Object> payload = new HashMap<>();
                payload.put("KeycloakId", userId);
                publisher.publish("user.events", "user.deleted", payload);
            }
        }
    }

    @Override
    public void close() { }
}
