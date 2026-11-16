package com.uit.cinema.chatbot.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@Data
@ConfigurationProperties(prefix = "cinema.ai")
public class CinemaAiProperties {

    private boolean enabled = false;
    private String baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    private String apiKey = "";
    private String model = "gemini-3.5-flash";
    private String embeddingModel = "gemini-embedding-001";
    private Duration timeout = Duration.ofSeconds(30);

    public boolean ready() {
        return enabled && apiKey != null && !apiKey.isBlank();
    }
}
