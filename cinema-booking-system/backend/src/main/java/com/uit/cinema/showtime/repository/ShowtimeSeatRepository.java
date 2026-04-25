package com.uit.cinema.showtime.repository;

import com.uit.cinema.showtime.entity.ShowtimeSeat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShowtimeSeatRepository extends JpaRepository<ShowtimeSeat, Long> {

    List<ShowtimeSeat> findByShowtimeId(Long showtimeId);

    Optional<ShowtimeSeat> findByShowtimeIdAndSeatTemplateId(Long showtimeId, Long seatTemplateId);

    @Query("SELECT s FROM ShowtimeSeat s WHERE s.showtimeId = :showtimeId AND s.status = 'AVAILABLE'")
    List<ShowtimeSeat> findAvailableSeats(Long showtimeId);
}
