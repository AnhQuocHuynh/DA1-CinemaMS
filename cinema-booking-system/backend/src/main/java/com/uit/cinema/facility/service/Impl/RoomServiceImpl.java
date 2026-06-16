package com.uit.cinema.facility.service.Impl;

import com.uit.cinema.facility.entity.SeatTemplate;
import com.uit.cinema.facility.entity.SeatType;
import com.uit.cinema.facility.repository.SeatTemplateRepository;
import com.uit.cinema.facility.repository.SeatTypeRepository;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.core.exception.ErrorCode;
import com.uit.cinema.facility.dto.request.RoomRequest;
import com.uit.cinema.facility.dto.response.RoomResponse;
import com.uit.cinema.facility.entity.Cinema;
import com.uit.cinema.facility.entity.Room;
import com.uit.cinema.facility.mapper.RoomMapper;
import com.uit.cinema.facility.repository.CinemaRepository;
import com.uit.cinema.facility.repository.RoomRepository;
import com.uit.cinema.facility.service.RoomService;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

    private final RoomRepository roomRepository;
    private final CinemaRepository cinemaRepository;
    private final SeatTemplateRepository seatTemplateRepository;
    private final SeatTypeRepository seatTypeRepository;
    private final RoomMapper roomMapper;
    private final EntityManager entityManager;

    @Override
    public List<RoomResponse> getRoomsByCinema(Long cinemaId) {
        return roomRepository.findByCinemaIdAndActiveTrue(cinemaId).stream()
                .map(roomMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    public RoomResponse getRoomById(Long id) {
        Room room = getRoomEntityById(id);
        return roomMapper.toResponse(room);
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

        Room room = roomMapper.toEntity(request);
        room.setCinema(cinema);
        
        Room savedRoom = roomRepository.save(room);

        // Automatically generate SeatTemplates based on rows and columns
        SeatType standardSeatType = getOrCreateStandardSeatType();
        int rows = request.getRows() != null ? request.getRows() : 0;
        int columns = request.getColumns() != null ? request.getColumns() : 0;
        for (int r = 0; r < rows; r++) {
            String rowLabel = String.valueOf((char) ('A' + r));
            for (int c = 1; c <= columns; c++) {
                SeatTemplate template = SeatTemplate.builder()
                        .room(savedRoom)
                        .seatType(standardSeatType)
                        .rowLabel(rowLabel)
                        .columnNumber(c)
                        .columnSpan(1)
                        .pathway(false)
                        .active(true)
                        .build();
                seatTemplateRepository.save(template);
            }
        }

        return roomMapper.toResponse(savedRoom);
    }

    private SeatType getOrCreateStandardSeatType() {
        return seatTypeRepository.findByCode(SeatType.SeatTypeCode.STANDARD)
            .or(() -> seatTypeRepository.findByNameIgnoreCase("standard"))
            .or(() -> seatTypeRepository.findByNameIgnoreCase("normal"))
            .map(type -> {
                type.setCode(SeatType.SeatTypeCode.STANDARD);
                type.setName("standard");
                type.setDisplayName("Standard");
                type.setPriceMultiplier(BigDecimal.ONE);
                type.setDefaultColumnSpan(1);
                return seatTypeRepository.save(type);
            })
            .orElseGet(() -> seatTypeRepository.save(SeatType.builder()
                .code(SeatType.SeatTypeCode.STANDARD)
                .name("standard")
                .displayName("Standard")
                .priceMultiplier(BigDecimal.ONE)
                .defaultColumnSpan(1)
                .description("Standard single seat")
                .build()));
    }

    @Override
    @Transactional
    public RoomResponse updateRoom(Long id, RoomRequest request) {
        Room existing = getRoomEntityById(id);
        roomMapper.updateEntity(existing, request);
        
        if (!existing.getCinema().getId().equals(request.getCinemaId())) {
            Cinema newCinema = cinemaRepository.findById(request.getCinemaId())
                .orElseThrow(() -> new CustomException("Rạp không tồn tại", HttpStatus.NOT_FOUND, "CINEMA_NOT_FOUND"));
            existing.setCinema(newCinema);
        }
        
        Room updated = roomRepository.save(existing);
        return roomMapper.toResponse(updated);
    }

    @Override
    @Transactional
    public void deleteRoom(Long id) {
        Room room = getRoomEntityById(id);
        
        Long count = entityManager.createQuery(
            "SELECT COUNT(s) FROM Showtime s WHERE s.roomId = :roomId AND s.startTime > :now AND s.status <> 'CANCELLED'",
            Long.class
        )
        .setParameter("roomId", id)
        .setParameter("now", java.time.LocalDateTime.now())
        .getSingleResult();
        
        if (count > 0) {
            throw new CustomException(
                ErrorCode.CONFLICT,
                "Không thể ngừng hoạt động phòng chiếu này vì vẫn còn suất chiếu đang hoạt động trong tương lai"
            );
        }
        
        room.setActive(false);
        roomRepository.save(room);
    }
}
