package com.uit.cinema.facility.service.client;

import com.uit.cinema.core.exception.CustomException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class UnavailableFacilityShowtimeGuard implements FacilityShowtimeGuard {

    @Override
    public boolean hasFutureShowtimesForRoom(Long roomId) {
        throw unavailable();
    }

    @Override
    public boolean hasFutureShowtimesForRooms(List<Long> roomIds) {
        if (roomIds == null || roomIds.isEmpty()) {
            return false;
        }
        throw unavailable();
    }

    private CustomException unavailable() {
        return new CustomException(
            "Showtime guard is not wired yet",
            HttpStatus.CONFLICT,
            "SHOWTIME_GUARD_UNAVAILABLE"
        );
    }
}
