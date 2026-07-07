package com.uit.cinema.catalog.service.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Slf4j
@Component
public class NoopEventShowtimeClient implements EventShowtimeClient {

    @Override
    public void createForEvent(Long eventId, Long roomId, LocalDateTime startTime, LocalDateTime endTime, BigDecimal basePrice) {
        log.info("Showtime service is not wired yet; skipped showtime creation for event {}", eventId);
    }

    @Override
    public void deleteByEvent(Long eventId) {
        log.info("Showtime service is not wired yet; skipped showtime deletion for event {}", eventId);
    }
}
