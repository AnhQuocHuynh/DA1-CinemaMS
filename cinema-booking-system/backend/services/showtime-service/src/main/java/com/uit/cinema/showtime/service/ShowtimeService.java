package com.uit.cinema.showtime.service;

import com.uit.cinema.showtime.dto.request.ShowtimeRequest;
import com.uit.cinema.showtime.dto.response.ShowtimeResponse;
import com.uit.cinema.showtime.dto.response.ShowtimeSeatResponse;
import com.uit.cinema.showtime.service.contract.EventShowtimeCreateRequest;

import java.util.List;

public interface ShowtimeService {
    List<ShowtimeResponse> getShowtimesByMovie(Long movieId);
    List<ShowtimeResponse> getShowtimesByEvent(Long eventId);
    List<ShowtimeResponse> getShowtimesByRoom(Long roomId);
    ShowtimeResponse getShowtimeById(Long id);
    List<ShowtimeSeatResponse> getSeatMap(Long showtimeId);
    ShowtimeSeatResponse getSeatById(Long seatId);
    boolean hasFutureShowtimesForRoom(Long roomId);
    boolean hasFutureShowtimesForRooms(List<Long> roomIds);
    ShowtimeResponse createShowtime(ShowtimeRequest request);
    ShowtimeResponse createShowtimeForEvent(EventShowtimeCreateRequest request);
    void deleteShowtime(Long id);
    void deleteFutureShowtimesByEvent(Long eventId);
}
