package com.uit.cinema.facility.service.Impl;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.facility.dto.request.RoomRequest;
import com.uit.cinema.facility.dto.response.RoomResponse;
import com.uit.cinema.facility.entity.Cinema;
import com.uit.cinema.facility.entity.Room;
import com.uit.cinema.facility.repository.CinemaRepository;
import com.uit.cinema.facility.repository.RoomRepository;
import com.uit.cinema.facility.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

    private final RoomRepository roomRepository;
    private final CinemaRepository cinemaRepository;

    @Override
    public List<RoomResponse> getRoomsByCinema(Long cinemaId) {
        return roomRepository.findByCinemaIdAndActiveTrue(cinemaId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public RoomResponse getRoomById(Long id) {
        Room room = getRoomEntityById(id);
        return mapToResponse(room);
    }

    private Room getRoomEntityById(Long id) {
        return roomRepository.findById(id)
            .orElseThrow(() -> new CustomException("Phòng chiếu không tồn tại", HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND"));
    }

    @Override
    @Transactional
    public RoomResponse createRoom(RoomRequest request) {
        Cinema cinema = cinemaRepository.findById(request.getCinemaId())
            .orElseThrow(() -> new CustomException("Rạp không tồn tại", HttpStatus.NOT_FOUND, "CINEMA_NOT_FOUND"));

        Room room = Room.builder()
                .cinema(cinema)
                .name(request.getName())
                .type(request.getType())
                .totalSeats(request.getTotalSeats())
                .rows(request.getRows())
                .columns(request.getColumns())
                .active(request.isActive())
                .build();
        
        Room savedRoom = roomRepository.save(room);
        return mapToResponse(savedRoom);
    }

    @Override
    @Transactional
    public void deleteRoom(Long id) {
        Room room = getRoomEntityById(id);
        room.setActive(false);
        roomRepository.save(room);
    }

    private RoomResponse mapToResponse(Room room) {
        return RoomResponse.builder()
                .id(room.getId())
                .cinemaId(room.getCinema().getId())
                .cinemaName(room.getCinema().getName())
                .name(room.getName())
                .type(room.getType())
                .totalSeats(room.getTotalSeats())
                .rows(room.getRows())
                .columns(room.getColumns())
                .active(room.isActive())
                .build();
    }
}
