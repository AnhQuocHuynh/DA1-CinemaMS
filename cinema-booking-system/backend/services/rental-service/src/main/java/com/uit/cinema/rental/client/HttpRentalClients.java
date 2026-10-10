package com.uit.cinema.rental.client;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.core.exception.CustomException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class HttpRentalClients implements
    RentalClients.FacilityRoomClient,
    RentalClients.MovieClient,
    RentalClients.ShowtimeSlotClient,
    RentalClients.CinemaScopeClient {

    private final RestClient facility;
    private final RestClient catalog;
    private final RestClient showtime;
    private final RestClient identity;

    public HttpRentalClients(
        RestClient.Builder builder,
        @Value("${services.facility.url}") String facilityUrl,
        @Value("${services.catalog.url}") String catalogUrl,
        @Value("${services.showtime.url}") String showtimeUrl,
        @Value("${services.identity.url}") String identityUrl,
        @Value("${app.internal-token}") String internalToken
    ) {
        this.facility = builder.clone().baseUrl(facilityUrl).defaultHeader("X-Internal-Token", internalToken).build();
        this.catalog = builder.clone().baseUrl(catalogUrl).build();
        this.showtime = builder.clone().baseUrl(showtimeUrl).defaultHeader("X-Internal-Token", internalToken).build();
        this.identity = builder.clone().baseUrl(identityUrl).defaultHeader("X-Internal-Token", internalToken).build();
    }

    @Override
    public RentalClients.FacilityRoom getRoom(Long roomId) {
        try {
            ApiResponse<FacilityRoomPayload> response = facility.get()
                .uri("/internal/facility/rooms/{roomId}", roomId)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.getData() == null) {
                throw new CustomException("Room not found", HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND");
            }
            FacilityRoomPayload room = response.getData();
            return new RentalClients.FacilityRoom(room.id, room.cinemaId, room.name, room.active, room.underMaintenance);
        } catch (CustomException ex) {
            throw ex;
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) {
                throw new CustomException("Room not found", HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND");
            }
            throw new CustomException("Facility is unavailable", HttpStatus.SERVICE_UNAVAILABLE, "FACILITY_UNAVAILABLE");
        } catch (RestClientException ex) {
            throw new CustomException("Facility is unavailable", HttpStatus.SERVICE_UNAVAILABLE, "FACILITY_UNAVAILABLE");
        }
    }

    @Override
    public RentalClients.MovieFact getMovie(Long movieId) {
        try {
            ApiResponse<MoviePayload> response = catalog.get()
                .uri("/api/movies/{id}", movieId)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.getData() == null) {
                throw new CustomException("Movie not found", HttpStatus.NOT_FOUND, "MOVIE_NOT_FOUND");
            }
            MoviePayload movie = response.getData();
            return new RentalClients.MovieFact(movie.id, movie.durationMinutes, movie.active);
        } catch (CustomException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw new CustomException("Catalog is unavailable", HttpStatus.SERVICE_UNAVAILABLE, "CATALOG_UNAVAILABLE");
        }
    }

    @Override
    public boolean hasShowtimeOverlap(Long roomId, LocalDateTime start, LocalDateTime end) {
        try {
            ApiResponse<Boolean> response = showtime.get()
                .uri(uri -> uri.path("/internal/showtimes/rooms/{roomId}/overlaps")
                    .queryParam("start", start.toString())
                    .queryParam("end", end.toString())
                    .build(roomId))
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.getData() == null) {
                throw new CustomException("Showtime is unavailable", HttpStatus.SERVICE_UNAVAILABLE, "SHOWTIME_UNAVAILABLE");
            }
            return response.getData();
        } catch (CustomException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw new CustomException("Showtime is unavailable", HttpStatus.SERVICE_UNAVAILABLE, "SHOWTIME_UNAVAILABLE");
        }
    }

    @Override
    public RentalClients.CinemaScope scopeOf(Long userId) {
        try {
            ApiResponse<ScopePayload> response = identity.get()
                .uri("/internal/users/{id}/cinema-scope", userId)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.getData() == null || response.getData().realmRole == null) {
                throw new CustomException("Identity is unavailable", HttpStatus.SERVICE_UNAVAILABLE, "IDENTITY_UNAVAILABLE");
            }
            ScopePayload scope = response.getData();
            List<Long> cinemas = scope.cinemaIds == null ? List.of() : scope.cinemaIds;
            return new RentalClients.CinemaScope(scope.realmRole, cinemas);
        } catch (CustomException ex) {
            throw ex;
        } catch (RestClientException ex) {
            throw new CustomException("Identity is unavailable", HttpStatus.SERVICE_UNAVAILABLE, "IDENTITY_UNAVAILABLE");
        }
    }

    private static final class FacilityRoomPayload {
        public Long id;
        public Long cinemaId;
        public String name;
        public boolean active;
        public boolean underMaintenance;
    }

    private static final class MoviePayload {
        public Long id;
        public Integer durationMinutes;
        public boolean active;
    }

    private static final class ScopePayload {
        public String realmRole;
        public List<Long> cinemaIds;
    }
}
