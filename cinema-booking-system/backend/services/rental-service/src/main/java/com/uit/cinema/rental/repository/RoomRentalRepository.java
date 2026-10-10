package com.uit.cinema.rental.repository;

import com.uit.cinema.rental.entity.RentalStatus;
import com.uit.cinema.rental.entity.RoomRental;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface RoomRentalRepository extends JpaRepository<RoomRental, Long> {

    @Query("""
        SELECT COUNT(r) FROM RoomRental r
        WHERE r.roomId = :roomId
          AND r.status IN :statuses
          AND r.startTime < :endTime
          AND r.endTime > :startTime
        """)
    long countOverlapping(
        @Param("roomId") Long roomId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime,
        @Param("statuses") Collection<RentalStatus> statuses
    );

    List<RoomRental> findByUserIdOrderByStartTimeDesc(Long userId);

    @Query("""
        SELECT r FROM RoomRental r
        WHERE r.startTime < :rangeEnd
          AND r.endTime > :rangeStart
        ORDER BY r.startTime
        """)
    List<RoomRental> findIntersecting(
        @Param("rangeStart") LocalDateTime rangeStart,
        @Param("rangeEnd") LocalDateTime rangeEnd
    );

    @Modifying
    @Query("""
        UPDATE RoomRental r
        SET r.status = :expired
        WHERE r.status IN :open
          AND r.expiresAt IS NOT NULL
          AND r.expiresAt <= :now
        """)
    int expireDue(
        @Param("now") LocalDateTime now,
        @Param("expired") RentalStatus expired,
        @Param("open") Collection<RentalStatus> open
    );
}
