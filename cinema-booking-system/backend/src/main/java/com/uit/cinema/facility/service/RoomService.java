package com.uit.cinema.facility.service;

import com.uit.cinema.facility.dto.request.RoomRequest;
import com.uit.cinema.facility.dto.response.RoomResponse;

import java.util.List;

public interface RoomService {
    List<RoomResponse> getRoomsByCinema(Long cinemaId);
    RoomResponse getRoomById(Long id);
    RoomResponse createRoom(RoomRequest request);
    RoomResponse updateRoom(Long id, RoomRequest request);
    void deleteRoom(Long id);
}
