package com.uit.cinema.showtime.repository;

import com.uit.cinema.showtime.entity.Showtime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ShowtimeRepository extends JpaRepository<Showtime, Long> {

    List<Showtime> findByMovieIdAndStartTimeAfterOrderByStartTimeAsc(Long movieId, LocalDateTime after);

    List<Showtime> findByEventIdAndStartTimeAfterOrderByStartTimeAsc(Long eventId, LocalDateTime after);

    List<Showtime> findByRoomIdAndStartTimeBetween(Long roomId, LocalDateTime from, LocalDateTime to);

    List<Showtime> findByRoomIdOrderByStartTimeAsc(Long roomId);

    boolean existsByRoomIdAndStartTimeAfterAndStatusNot(
        Long roomId,
        LocalDateTime startTime,
        Showtime.Status status
    );

    boolean existsByRoomIdInAndStartTimeAfterAndStatusNot(
        List<Long> roomIds,
        LocalDateTime startTime,
        Showtime.Status status
    );

    @Query("""
        SELECT s FROM Showtime s
        WHERE s.roomId = :roomId
          AND s.status <> :cancelled
          AND s.startTime < :rangeEnd
          AND s.endTime > :rangeStart
        ORDER BY s.startTime
        """)
    List<Showtime> findActiveIntersecting(
        @Param("roomId") Long roomId,
        @Param("rangeStart") LocalDateTime rangeStart,
        @Param("rangeEnd") LocalDateTime rangeEnd,
        @Param("cancelled") Showtime.Status cancelled
    );

    @Query("""
        SELECT COUNT(s) FROM Showtime s
        WHERE s.roomId = :roomId
          AND s.status <> :cancelled
          AND s.startTime < :endTime
          AND s.endTime > :startTime
        """)
    long countActiveOverlap(
        @Param("roomId") Long roomId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime,
        @Param("cancelled") Showtime.Status cancelled
    );
}
