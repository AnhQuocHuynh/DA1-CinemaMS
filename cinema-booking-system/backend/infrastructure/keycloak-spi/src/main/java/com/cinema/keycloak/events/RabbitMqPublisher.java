package com.cinema.keycloak.events;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.TimeoutException;

public class RabbitMqPublisher {

    private Connection connection;
    private Channel channel;
    private final ObjectMapper objectMapper;

    public RabbitMqPublisher(String host, String username, String password) {
        this.objectMapper = new ObjectMapper();
        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost(host);
        factory.setUsername(username);
        factory.setPassword(password);

        try {
            this.connection = factory.newConnection();
            this.channel = connection.createChannel();
            // Declare an exchange just in case it's not created by the consumer
            this.channel.exchangeDeclare("user.events", "topic", true);
        } catch (IOException | TimeoutException e) {
            System.err.println("Failed to connect to RabbitMQ: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public void publish(String exchange, String routingKey, Map<String, Object> payload) {
        if (this.channel != null && this.channel.isOpen()) {
            try {
                String jsonPayload = objectMapper.writeValueAsString(payload);
                this.channel.basicPublish(exchange, routingKey, null, jsonPayload.getBytes("UTF-8"));
                System.out.println("Published event to RabbitMQ: " + routingKey);
            } catch (IOException e) {
                System.err.println("Failed to publish event to RabbitMQ: " + e.getMessage());
                e.printStackTrace();
            }
        } else {
            System.err.println("Cannot publish message, RabbitMQ channel is not open.");
        }
    }

    public void close() {
        try {
            if (this.channel != null && this.channel.isOpen()) {
                this.channel.close();
            }
            if (this.connection != null && this.connection.isOpen()) {
                this.connection.close();
            }
        } catch (IOException | TimeoutException e) {
            System.err.println("Error while closing RabbitMQ connection: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
