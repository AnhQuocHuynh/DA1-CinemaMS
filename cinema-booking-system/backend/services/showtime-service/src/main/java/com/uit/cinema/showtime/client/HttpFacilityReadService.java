package com.uit.cinema.showtime.client;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.facility.service.FacilityReadService;
import com.uit.cinema.facility.service.contract.FacilityRoomView;
import com.uit.cinema.facility.service.contract.FacilitySeatTemplateView;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Optional;

@Component
public class HttpFacilityReadService implements FacilityReadService {

    private final RestClient restClient;

    public HttpFacilityReadService(
        RestClient.Builder builder,
        @Value("${services.facility.url:http://localhost:5002}") String facilityBaseUrl,
        @Value("${app.internal-token}") String internalToken
    ) {
        this.restClient = builder
            .baseUrl(facilityBaseUrl)
            .defaultHeader("X-Internal-Token", internalToken)
            .build();
    }

    @Override
    public Optional<FacilityRoomView> findRoom(Long roomId) {
        if (roomId == null) {
            return Optional.empty();
        }
        try {
            ApiResponse<FacilityRoomView> response = restClient.get()
                .uri("/internal/facility/rooms/{roomId}", roomId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<FacilityRoomView>>() {});
            return Optional.ofNullable(response).map(ApiResponse::getData);
        } catch (RestClientException ex) {
            return Optional.empty();
        }
    }

    @Override
    public Optional<FacilitySeatTemplateView> findSeatTemplate(Long seatTemplateId) {
        if (seatTemplateId == null) {
            return Optional.empty();
        }
        try {
            ApiResponse<FacilitySeatTemplateView> response = restClient.get()
                .uri("/internal/facility/seat-templates/{seatTemplateId}", seatTemplateId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<FacilitySeatTemplateView>>() {});
            return Optional.ofNullable(response).map(ApiResponse::getData);
        } catch (RestClientException ex) {
            return Optional.empty();
        }
    }

    @Override
    public List<FacilitySeatTemplateView> findActiveSeatTemplatesByRoom(Long roomId) {
        if (roomId == null) {
            return List.of();
        }
        try {
            ApiResponse<List<FacilitySeatTemplateView>> response = restClient.get()
                .uri("/internal/facility/rooms/{roomId}/seat-templates", roomId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<List<FacilitySeatTemplateView>>>() {});
            return Optional.ofNullable(response)
                .map(ApiResponse::getData)
                .orElseGet(List::of);
        } catch (RestClientException ex) {
            return List.of();
        }
    }
}
