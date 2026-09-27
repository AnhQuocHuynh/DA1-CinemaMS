package com.uit.cinema.catalog.service.client;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public interface EventShowtimeClient {
    void createForEvent(Long eventId, Long roomId, LocalDateTime startTime, LocalDateTime endTime, BigDecimal basePrice);
    void deleteByEvent(Long eventId);
}
