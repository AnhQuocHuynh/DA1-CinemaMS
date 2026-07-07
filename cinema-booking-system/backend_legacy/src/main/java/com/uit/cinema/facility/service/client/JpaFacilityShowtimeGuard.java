package com.uit.cinema.facility.service.client;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JpaFacilityShowtimeGuard implements FacilityShowtimeGuard {

    private final EntityManager entityManager;

    @Override
    public boolean hasFutureShowtimesForRoom(Long roomId) {
        if (roomId == null) {
            return false;
        }
        Long count = entityManager.createQuery(
            "SELECT COUNT(s) FROM Showtime s WHERE s.roomId = :roomId AND s.startTime > :now AND s.status <> 'CANCELLED'",
            Long.class
        )
        .setParameter("roomId", roomId)
        .setParameter("now", LocalDateTime.now())
        .getSingleResult();
        return count > 0;
    }

    @Override
    public boolean hasFutureShowtimesForRooms(List<Long> roomIds) {
        if (roomIds == null || roomIds.isEmpty()) {
            return false;
        }
        Long count = entityManager.createQuery(
            "SELECT COUNT(s) FROM Showtime s WHERE s.roomId IN :roomIds AND s.startTime > :now AND s.status <> 'CANCELLED'",
            Long.class
        )
        .setParameter("roomIds", roomIds)
        .setParameter("now", LocalDateTime.now())
        .getSingleResult();
        return count > 0;
    }
}
