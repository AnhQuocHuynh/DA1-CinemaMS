package com.uit.cinema.booking.client;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;
import com.uit.cinema.showtime.service.contract.SeatReleaseRequest;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import com.uit.cinema.showtime.service.contract.ShowtimeSeatView;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.Optional;

@Slf4j
@Component
public class HttpSeatReservationService implements SeatReservationService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public HttpSeatReservationService(
        RestClient.Builder builder,
        ObjectMapper objectMapper,
        @Value("${services.showtime.url:http://localhost:8082}") String showtimeBaseUrl,
        @Value("${app.internal-token}") String internalToken
    ) {
        this.objectMapper = objectMapper;
        this.restClient = builder
            .baseUrl(showtimeBaseUrl)
            .defaultHeader("X-Internal-Token", internalToken)
            .build();
    }

    @Override
    public SeatHoldValidationResult validateHeldSeats(SeatBookingRequest request) {
        return post(
            "/internal/showtimes/seats/validate-held",
            request,
            new ParameterizedTypeReference<ApiResponse<SeatHoldValidationResult>>() {}
        );
    }

    @Override
    public SeatHoldValidationResult validateAvailableSeats(SeatBookingRequest request) {
        return post(
            "/internal/showtimes/seats/validate-available",
            request,
            new ParameterizedTypeReference<ApiResponse<SeatHoldValidationResult>>() {}
        );
    }

    @Override
    public SeatBookingResult confirmHeldSeats(SeatBookingRequest request) {
        return post(
            "/internal/showtimes/seats/confirm-held",
            request,
            new ParameterizedTypeReference<ApiResponse<SeatBookingResult>>() {}
        );
    }

    @Override
    public SeatBookingResult bookAvailableSeats(SeatBookingRequest request) {
        return post(
            "/internal/showtimes/seats/book-available",
            request,
            new ParameterizedTypeReference<ApiResponse<SeatBookingResult>>() {}
        );
    }

    @Override
    public void releaseHeldSeats(SeatBookingRequest request) {
        post(
            "/internal/showtimes/seats/release-held",
            request,
            new ParameterizedTypeReference<ApiResponse<Object>>() {}
        );
    }

    @Override
    public void releaseBookedSeats(SeatReleaseRequest request) {
        post(
            "/internal/showtimes/seats/release-booked",
            request,
            new ParameterizedTypeReference<ApiResponse<Object>>() {}
        );
    }

    @Override
    public ShowtimeScheduleView getSchedule(Long showtimeId) {
        return findSchedule(showtimeId)
            .orElseThrow(() -> new CustomException("Showtime not found", HttpStatus.NOT_FOUND, "SHOWTIME_NOT_FOUND"));
    }

    @Override
    public Optional<ShowtimeScheduleView> findSchedule(Long showtimeId) {
        if (showtimeId == null) {
            return Optional.empty();
        }
        return get(
            "/internal/showtimes/{showtimeId}/schedule",
            showtimeId,
            new ParameterizedTypeReference<ApiResponse<ShowtimeScheduleView>>() {}
        );
    }

    @Override
    public Optional<ShowtimeSeatView> findSeat(Long seatId) {
        if (seatId == null) {
            return Optional.empty();
        }
        return get(
            "/internal/showtimes/seats/{seatId}",
            seatId,
            new ParameterizedTypeReference<ApiResponse<ShowtimeSeatView>>() {}
        );
    }

    private <T> T post(String uri, Object body, ParameterizedTypeReference<ApiResponse<T>> responseType) {
        try {
            ApiResponse<T> response = restClient.post()
                .uri(uri)
                .body(body)
                .retrieve()
                .body(responseType);
            return requireData(response);
        } catch (RestClientResponseException ex) {
            log.error("Showtime service returned {} on POST {}: body={}", ex.getStatusCode(), uri, ex.getResponseBodyAsString());
            throw handleResponseException(ex);
        } catch (RestClientException ex) {
            log.error("Failed to connect to showtime service on POST {}: {}", uri, ex.getMessage());
            throw unavailable();
        }
    }

    private CustomException handleResponseException(RestClientResponseException ex) {
        if (ex.getStatusCode().is5xxServerError()) {
            return unavailable();
        }
        try {
            ApiResponse<?> err = objectMapper.readValue(ex.getResponseBodyAsString(), ApiResponse.class);
            if (err != null && err.getMessage() != null && !err.getMessage().isBlank()) {
                HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
                return new CustomException(
                    err.getMessage(),
                    status != null ? status : HttpStatus.BAD_REQUEST,
                    err.getErrorCode() != null ? err.getErrorCode() : "SHOWTIME_ERROR"
                );
            }
        } catch (Exception ignored) {
        }
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        return new CustomException(
            "Showtime service error: " + ex.getStatusText(),
            status != null ? status : HttpStatus.BAD_REQUEST,
            "SHOWTIME_ERROR"
        );
    }

    private <T> Optional<T> get(String uri, Object uriVariable, ParameterizedTypeReference<ApiResponse<T>> responseType) {
        try {
            ApiResponse<T> response = restClient.get()
                .uri(uri, uriVariable)
                .retrieve()
                .body(responseType);
            return Optional.ofNullable(response).map(ApiResponse::getData);
        } catch (RestClientResponseException ex) {
            log.warn("Showtime service returned {} on GET {}: body={}", ex.getStatusCode(), uri, ex.getResponseBodyAsString());
            return Optional.empty();
        } catch (RestClientException ex) {
            log.warn("Failed to connect to showtime service on GET {}: {}", uri, ex.getMessage());
            return Optional.empty();
        }
    }

    private <T> T requireData(ApiResponse<T> response) {
        if (response == null || !response.isSuccess()) {
            throw unavailable();
        }
        return response.getData();
    }

    private CustomException unavailable() {
        return new CustomException(
            "Showtime reservation service is unavailable",
            HttpStatus.SERVICE_UNAVAILABLE,
            "SHOWTIME_RESERVATION_UNAVAILABLE"
        );
    }
}
