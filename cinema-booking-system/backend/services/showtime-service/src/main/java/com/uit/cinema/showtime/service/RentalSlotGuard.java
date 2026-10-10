package com.uit.cinema.showtime.service;

import java.time.LocalDateTime;

public interface RentalSlotGuard {
    void assertSlotFree(Long roomId, LocalDateTime start, LocalDateTime end);
}
