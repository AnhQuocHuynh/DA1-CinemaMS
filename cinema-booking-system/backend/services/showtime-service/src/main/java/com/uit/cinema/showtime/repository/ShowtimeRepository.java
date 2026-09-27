package com.uit.cinema.showtime.repository;

import com.uit.cinema.showtime.entity.Showtime;
import org.springframework.data.jpa.repository.JpaRepository;
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
}
