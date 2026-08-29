package com.cinema.keycloak.events;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.TimeoutException;

public class RabbitMqPublisher {

    private final ConnectionFactory factory;
    private final ObjectMapper objectMapper;
    private Connection connection;
    private Channel channel;

    public RabbitMqPublisher(String host, String username, String password) {
        this.objectMapper = new ObjectMapper();
        this.factory = new ConnectionFactory();
        this.factory.setHost(host);
        this.factory.setUsername(username);
        this.factory.setPassword(password);
        // Don't connect here — connect lazily on first publish
    }

    private synchronized boolean ensureConnection() {
        if (this.channel != null && this.channel.isOpen()) {
            return true;
        }
        // Try to establish/re-establish connection
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                System.out.println("RabbitMQ connection attempt " + attempt + "/3 to host: " + factory.getHost());
                this.connection = factory.newConnection();
                this.channel = connection.createChannel();
                this.channel.exchangeDeclare("user.events", "topic", true);
                System.out.println("Successfully connected to RabbitMQ on attempt " + attempt);
                return true;
            } catch (IOException | TimeoutException e) {
                System.err.println("RabbitMQ connection attempt " + attempt + " failed: " + e.getMessage());
                closeQuietly();
                if (attempt < 3) {
                    try {
                        Thread.sleep(2000L * attempt); // 2s, 4s backoff
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return false;
                    }
                }
            }
        }
        return false;
    }

    public void publish(String exchange, String routingKey, Map<String, Object> payload) {
        if (!ensureConnection()) {
            System.err.println("Cannot publish message, RabbitMQ connection could not be established.");
            return;
        }
        try {
            String jsonPayload = objectMapper.writeValueAsString(payload);
            
            AMQP.BasicProperties props = new AMQP.BasicProperties.Builder()
                .contentType("application/json")
                .build();
                
            this.channel.basicPublish(exchange, routingKey, props, jsonPayload.getBytes("UTF-8"));
            System.out.println("Published event to RabbitMQ: " + routingKey);
        } catch (IOException e) {
            System.err.println("Failed to publish event to RabbitMQ: " + e.getMessage());
            closeQuietly(); // Force reconnect on next publish
        }
    }

    private void closeQuietly() {
        try {
            if (this.channel != null && this.channel.isOpen()) {
                this.channel.close();
            }
        } catch (Exception ignored) { }
        try {
            if (this.connection != null && this.connection.isOpen()) {
                this.connection.close();
            }
        } catch (Exception ignored) { }
        this.channel = null;
        this.connection = null;
    }

    public void close() {
        closeQuietly();
    }
}
