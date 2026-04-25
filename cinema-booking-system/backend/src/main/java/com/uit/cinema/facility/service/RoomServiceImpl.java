package com.uit.cinema.facility.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.facility.entity.Room;
import com.uit.cinema.facility.repository.RoomRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

    private final RoomRepository roomRepository;

    @Override
    public List<Room> getRoomsByCinema(Long cinemaId) {
        return roomRepository.findByCinemaIdAndActiveTrue(cinemaId);
    }

    @Override
    public Room getRoomById(Long id) {
        return roomRepository.findById(id)
            .orElseThrow(() -> new CustomException("Phòng chiếu không tồn tại", HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND"));
    }

    @Override
    @Transactional
    public Room createRoom(Room room) {
        return roomRepository.save(room);
    }

    @Override
    @Transactional
    public void deleteRoom(Long id) {
        Room room = getRoomById(id);
        room.setActive(false);
        roomRepository.save(room);
    }
}
