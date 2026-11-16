package com.uit.cinema.chatbot.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

@Configuration
@EnableConfigurationProperties({CinemaAiProperties.class, ChatbotProperties.class, ServiceUrlProperties.class})
public class ChatbotInfrastructureConfig {

    @Bean
    RestClient geminiRestClient(CinemaAiProperties properties) {
        return client(properties.getBaseUrl(), properties.getTimeout());
    }

    @Bean
    RestClient catalogRestClient(ServiceUrlProperties properties) {
        return client(properties.getCatalog().getUrl(), Duration.ofSeconds(5));
    }

    @Bean
    RestClient showtimeRestClient(ServiceUrlProperties properties) {
        return client(properties.getShowtime().getUrl(), Duration.ofSeconds(5));
    }

    @Bean
    RestClient bookingRestClient(ServiceUrlProperties properties) {
        return client(properties.getBooking().getUrl(), Duration.ofSeconds(5));
    }

    @Bean
    RestClient recommendationRestClient(ServiceUrlProperties properties) {
        return client(properties.getRecommendation().getUrl(), Duration.ofSeconds(5));
    }

    @Bean(name = "chatbotReplyExecutor")
    Executor chatbotReplyExecutor() {
        return new ThreadPoolExecutor(
            2,
            8,
            30,
            TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(50),
            new ThreadPoolExecutor.AbortPolicy()
        );
    }

    private static RestClient client(String baseUrl, Duration timeout) {
        Duration limit = timeout == null ? Duration.ofSeconds(30) : timeout;
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(limit).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(limit);
        return RestClient.builder()
            .baseUrl(baseUrl == null ? "" : baseUrl)
            .requestFactory(requestFactory)
            .build();
    }
}
