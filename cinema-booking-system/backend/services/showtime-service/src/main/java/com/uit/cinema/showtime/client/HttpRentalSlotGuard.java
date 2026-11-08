package com.uit.cinema.showtime.client;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.service.RentalSlotGuard;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.LocalDateTime;

@Component
public class HttpRentalSlotGuard implements RentalSlotGuard {

    private final RestClient restClient;

    public HttpRentalSlotGuard(
        RestClient.Builder builder,
        @Value("${services.rental.url:http://localhost:8086}") String rentalBaseUrl,
        @Value("${app.internal-token}") String internalToken
    ) {
        this.restClient = builder
            .baseUrl(rentalBaseUrl)
            .defaultHeader("X-Internal-Token", internalToken)
            .build();
    }

    @Override
    public void assertSlotFree(Long roomId, LocalDateTime start, LocalDateTime end) {
        try {
            ApiResponse<Boolean> response = restClient.get()
                .uri(uri -> uri.path("/internal/rentals/rooms/{roomId}/overlaps")
                    .queryParam("start", start.toString())
                    .queryParam("end", end.toString())
                    .build(roomId))
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.getData() == null) {
                throw new CustomException("Rental service is unavailable", HttpStatus.SERVICE_UNAVAILABLE, "RENTAL_SERVICE_UNAVAILABLE");
            }
            if (response.getData()) {
                throw new CustomException("Showtime overlaps a room rental", HttpStatus.CONFLICT, "RENTAL_SLOT_TAKEN");
            }
        } catch (CustomException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw new CustomException("Rental service is unavailable", HttpStatus.SERVICE_UNAVAILABLE, "RENTAL_SERVICE_UNAVAILABLE");
        }
    }
}
