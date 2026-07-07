package com.uit.cinema.catalog.service.client;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.uit.cinema.core.exception.CustomException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Component
public class HttpEventShowtimeClient implements EventShowtimeClient {

    private final RestClient restClient;

    public HttpEventShowtimeClient(
        RestClient.Builder builder,
        @Value("${services.showtime.url:http://localhost:8082}") String showtimeBaseUrl,
        @Value("${app.internal-token}") String internalToken
    ) {
        this(builder
            .baseUrl(showtimeBaseUrl)
            .defaultHeader("X-Internal-Token", internalToken)
            .build());
    }

    HttpEventShowtimeClient(RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public void createForEvent(Long eventId, Long roomId, LocalDateTime startTime, LocalDateTime endTime, BigDecimal basePrice) {
        try {
            restClient.post()
                .uri("/internal/showtimes/events")
                .body(new EventShowtimeCreateRequest(eventId, roomId, startTime, endTime, basePrice))
                .retrieve()
                .toBodilessEntity();
        } catch (RestClientException ex) {
            throw syncFailed();
        }
    }

    @Override
    public void deleteByEvent(Long eventId) {
        try {
            restClient.delete()
                .uri("/internal/showtimes/events/{eventId}", eventId)
                .retrieve()
                .toBodilessEntity();
        } catch (RestClientException ex) {
            throw syncFailed();
        }
    }

    private CustomException syncFailed() {
        return new CustomException(
            "Failed to synchronize event showtime",
            HttpStatus.CONFLICT,
            "EVENT_SHOWTIME_SYNC_FAILED"
        );
    }

    private record EventShowtimeCreateRequest(
        Long eventId,
        Long roomId,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        LocalDateTime startTime,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
        LocalDateTime endTime,
        BigDecimal basePrice
    ) {
    }
}
