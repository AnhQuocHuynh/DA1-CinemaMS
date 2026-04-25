package com.uit.cinema.showtime.service;

import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import java.util.List;

public interface ShowtimeService {
    List<Showtime> getShowtimesByMovie(Long movieId);
    Showtime getShowtimeById(Long id);
    List<ShowtimeSeat> getSeatMap(Long showtimeId);
    Showtime createShowtime(Showtime showtime);
}
