package com.uit.cinema.showtime.service;

import com.uit.cinema.showtime.dto.request.ShowtimeRequest;
import com.uit.cinema.showtime.dto.response.ShowtimeResponse;
import com.uit.cinema.showtime.dto.response.ShowtimeSeatResponse;

import java.util.List;

public interface ShowtimeService {
    List<ShowtimeResponse> getShowtimesByMovie(Long movieId);
    ShowtimeResponse getShowtimeById(Long id);
    List<ShowtimeSeatResponse> getSeatMap(Long showtimeId);
    ShowtimeSeatResponse getSeatById(Long seatId);
    ShowtimeResponse createShowtime(ShowtimeRequest request);
}
