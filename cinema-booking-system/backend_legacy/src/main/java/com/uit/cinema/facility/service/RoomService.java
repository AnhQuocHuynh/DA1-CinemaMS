package com.uit.cinema.facility.service;

import com.uit.cinema.facility.dto.request.RoomRequest;
import com.uit.cinema.facility.dto.request.SeatMapUpdateRequest;
import com.uit.cinema.facility.dto.response.RoomResponse;
import com.uit.cinema.facility.dto.response.SeatTemplateResponse;

import java.util.List;

public interface RoomService {
    List<RoomResponse> getRoomsByCinema(Long cinemaId);
    RoomResponse getRoomById(Long id);
    RoomResponse createRoom(RoomRequest request);
    RoomResponse updateRoom(Long id, RoomRequest request);
    void deleteRoom(Long id);
    List<SeatTemplateResponse> getSeatMapByRoomId(Long id);
    void updateSeatMap(Long id, SeatMapUpdateRequest request);
}
