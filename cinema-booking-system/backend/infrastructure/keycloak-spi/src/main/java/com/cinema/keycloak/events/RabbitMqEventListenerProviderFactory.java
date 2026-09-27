package com.cinema.keycloak.events;

import org.keycloak.Config;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventListenerProviderFactory;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

public class RabbitMqEventListenerProviderFactory implements EventListenerProviderFactory {

    private static final String PROVIDER_ID = "rabbitmq-event-listener";
    private RabbitMqPublisher publisher;

    @Override
    public EventListenerProvider create(KeycloakSession session) {
        return new RabbitMqEventListenerProvider(session, publisher);
    }

    @Override
    public void init(Config.Scope config) {
        // Initialize RabbitMQ publisher connection here
        // Read host, port, credentials from env vars or defaults
        String host = System.getenv().getOrDefault("RABBITMQ_HOST", "localhost");
        String username = System.getenv().getOrDefault("RABBITMQ_USERNAME", "guest");
        String password = System.getenv().getOrDefault("RABBITMQ_PASSWORD", "guest");
        
        this.publisher = new RabbitMqPublisher(host, username, password);
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) { }

    @Override
    public void close() {
        if (publisher != null) {
            publisher.close();
        }
    }

    @Override
    public String getId() {
        return PROVIDER_ID;
    }
}
