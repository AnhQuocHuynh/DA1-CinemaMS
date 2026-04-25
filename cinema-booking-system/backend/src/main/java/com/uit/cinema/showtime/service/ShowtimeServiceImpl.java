package com.uit.cinema.showtime.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ShowtimeServiceImpl implements ShowtimeService {

    private final ShowtimeRepository showtimeRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;

    @Override
    public List<Showtime> getShowtimesByMovie(Long movieId) {
        return showtimeRepository.findByMovieIdAndStartTimeAfterOrderByStartTimeAsc(movieId, LocalDateTime.now());
    }

    @Override
    public Showtime getShowtimeById(Long id) {
        return showtimeRepository.findById(id)
            .orElseThrow(() -> new CustomException("Suất chiếu không tồn tại", HttpStatus.NOT_FOUND, "SHOWTIME_NOT_FOUND"));
    }

    @Override
    public List<ShowtimeSeat> getSeatMap(Long showtimeId) {
        return showtimeSeatRepository.findByShowtimeId(showtimeId);
    }

    @Override
    @Transactional
    public Showtime createShowtime(Showtime showtime) {
        return showtimeRepository.save(showtime);
    }
}
