package com.uit.cinema.showtime.service.contract;

import java.util.List;

public record RoomShowtimeCheckRequest(List<Long> roomIds) {
}
