package com.uit.cinema.facility.service;

import com.uit.cinema.facility.entity.Room;

import java.util.List;

public interface RoomService {
    List<Room> getRoomsByCinema(Long cinemaId);
    Room getRoomById(Long id);
    Room createRoom(Room room);
    void deleteRoom(Long id);
}
