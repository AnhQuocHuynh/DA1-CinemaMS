package com.uit.cinema.chatbot.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "services")
public class ServiceUrlProperties {

    private Endpoint catalog = new Endpoint();
    private Endpoint showtime = new Endpoint();
    private Endpoint booking = new Endpoint();
    private Endpoint recommendation = new Endpoint();

    @Data
    public static class Endpoint {
        private String url = "http://localhost";
    }
}
