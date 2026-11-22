package com.uit.cinema.catalog.config;

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
    private Duration timeout = Duration.ofSeconds(30);
}
