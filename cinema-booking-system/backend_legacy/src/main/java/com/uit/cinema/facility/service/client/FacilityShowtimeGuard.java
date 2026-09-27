package com.uit.cinema.facility.service.client;

import java.util.List;

public interface FacilityShowtimeGuard {
    boolean hasFutureShowtimesForRoom(Long roomId);
    boolean hasFutureShowtimesForRooms(List<Long> roomIds);
}
