package com.uit.cinema.catalog.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

@Configuration
@EnableConfigurationProperties(CinemaAiProperties.class)
public class CinemaAiConfig {

    @Bean
    RestClient geminiRestClient(CinemaAiProperties properties) {
        Duration timeout = properties.getTimeout() == null ? Duration.ofSeconds(30) : properties.getTimeout();
        HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(timeout)
            .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(timeout);
        return RestClient.builder()
            .baseUrl(properties.getBaseUrl())
            .requestFactory(requestFactory)
            .build();
    }
}
