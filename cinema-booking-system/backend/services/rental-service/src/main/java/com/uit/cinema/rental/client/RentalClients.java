package com.uit.cinema.rental.client;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public interface RentalClients {

    record FacilityRoom(Long id, Long cinemaId, String name, boolean active, boolean underMaintenance) {
    }

    record MovieFact(Long id, Integer durationMinutes, boolean active) {
    }

    record CinemaScope(String realmRole, List<Long> cinemaIds) {
    }

    interface FacilityRoomClient {
        FacilityRoom getRoom(Long roomId);
    }

    interface MovieClient {
        MovieFact getMovie(Long movieId);
    }

    interface ShowtimeSlotClient {
        boolean hasShowtimeOverlap(Long roomId, LocalDateTime start, LocalDateTime end);
    }

    interface CinemaScopeClient {
        CinemaScope scopeOf(Long userId);
    }
}
