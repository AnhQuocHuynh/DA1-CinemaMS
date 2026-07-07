package com.uit.cinema.facility.service.client;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.core.exception.CustomException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

@Component
public class HttpFacilityShowtimeGuard implements FacilityShowtimeGuard {

    private final RestClient restClient;

    public HttpFacilityShowtimeGuard(
        RestClient.Builder builder,
        @Value("${services.showtime.url:http://localhost:8082}") String showtimeBaseUrl,
        @Value("${app.internal-token}") String internalToken
    ) {
        this(builder
            .baseUrl(showtimeBaseUrl)
            .defaultHeader("X-Internal-Token", internalToken)
            .build());
    }

    HttpFacilityShowtimeGuard(RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public boolean hasFutureShowtimesForRoom(Long roomId) {
        if (roomId == null) {
            return false;
        }
        try {
            ApiResponse<Boolean> response = restClient.get()
                .uri("/internal/showtimes/rooms/{roomId}/future-exists", roomId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<Boolean>>() {});
            return requireBoolean(response);
        } catch (RestClientException ex) {
            throw unavailable();
        }
    }

    @Override
    public boolean hasFutureShowtimesForRooms(List<Long> roomIds) {
        if (roomIds == null || roomIds.isEmpty()) {
            return false;
        }
        try {
            ApiResponse<Boolean> response = restClient.post()
                .uri("/internal/showtimes/rooms/future-exists")
                .body(new RoomShowtimeCheckRequest(roomIds))
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<Boolean>>() {});
            return requireBoolean(response);
        } catch (RestClientException ex) {
            throw unavailable();
        }
    }

    private boolean requireBoolean(ApiResponse<Boolean> response) {
        if (response == null || !response.isSuccess() || response.getData() == null) {
            throw unavailable();
        }
        return response.getData();
    }

    private CustomException unavailable() {
        return new CustomException(
            "Showtime guard is unavailable",
            HttpStatus.CONFLICT,
            "SHOWTIME_GUARD_UNAVAILABLE"
        );
    }

    private record RoomShowtimeCheckRequest(List<Long> roomIds) {
    }
}
