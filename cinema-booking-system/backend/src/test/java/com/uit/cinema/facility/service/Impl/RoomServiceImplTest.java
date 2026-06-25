package com.uit.cinema.facility.service.Impl;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.facility.dto.request.RoomRequest;
import com.uit.cinema.facility.dto.request.SeatMapUpdateRequest;
import com.uit.cinema.facility.dto.response.RoomResponse;
import com.uit.cinema.facility.dto.response.SeatTemplateResponse;
import com.uit.cinema.facility.entity.Cinema;
import com.uit.cinema.facility.entity.Room;
import com.uit.cinema.facility.entity.SeatTemplate;
import com.uit.cinema.facility.entity.SeatType;
import com.uit.cinema.facility.mapper.RoomMapper;
import com.uit.cinema.facility.repository.CinemaRepository;
import com.uit.cinema.facility.repository.RoomRepository;
import com.uit.cinema.facility.repository.SeatTemplateRepository;
import com.uit.cinema.facility.repository.SeatTypeRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RoomServiceImplTest {

    @Mock
    private RoomRepository roomRepository;
    @Mock
    private CinemaRepository cinemaRepository;
    @Mock
    private SeatTemplateRepository seatTemplateRepository;
    @Mock
    private SeatTypeRepository seatTypeRepository;
    @Mock
    private RoomMapper roomMapper;
    @Mock
    private EntityManager entityManager;
    @Mock
    private TypedQuery<Long> typedQuery;

    @InjectMocks
    private RoomServiceImpl roomService;

    @Test
    void getRoomsByCinema_ReturnsList() {
        Room room = new Room();
        when(roomRepository.findByCinemaIdAndActiveTrue(1L)).thenReturn(List.of(room));
        when(roomMapper.toResponse(room)).thenReturn(new RoomResponse());

        List<RoomResponse> responses = roomService.getRoomsByCinema(1L);

        assertEquals(1, responses.size());
    }

    @Test
    void createRoom_GeneratesSeats() {
        RoomRequest request = new RoomRequest();
        request.setCinemaId(1L);
        request.setRows(2);
        request.setColumns(2);

        Cinema cinema = new Cinema();
        when(cinemaRepository.findById(1L)).thenReturn(Optional.of(cinema));

        Room room = new Room();
        when(roomMapper.toEntity(request)).thenReturn(room);
        when(roomRepository.save(any(Room.class))).thenReturn(room);
        when(roomMapper.toResponse(room)).thenReturn(new RoomResponse());

        SeatType standardSeatType = new SeatType();
        standardSeatType.setCode(SeatType.SeatTypeCode.STANDARD);
        when(seatTypeRepository.findByCode(SeatType.SeatTypeCode.STANDARD)).thenReturn(Optional.of(standardSeatType));

        RoomResponse response = roomService.createRoom(request);

        assertNotNull(response);
        verify(seatTemplateRepository, times(4)).save(any(SeatTemplate.class)); // 2 rows * 2 columns = 4
    }

    @Test
    void deleteRoom_WhenNoFutureShowtimes_SoftDeletes() {
        Room room = new Room();
        room.setActive(true);
        when(roomRepository.findById(1L)).thenReturn(Optional.of(room));

        when(entityManager.createQuery(anyString(), eq(Long.class))).thenReturn(typedQuery);
        when(typedQuery.setParameter(eq("roomId"), eq(1L))).thenReturn(typedQuery);
        when(typedQuery.setParameter(eq("now"), any())).thenReturn(typedQuery);
        when(typedQuery.getSingleResult()).thenReturn(0L);

        roomService.deleteRoom(1L);

        assertFalse(room.isActive());
        verify(roomRepository).save(room);
    }

    @Test
    void deleteRoom_WhenFutureShowtimesExist_ThrowsException() {
        Room room = new Room();
        room.setActive(true);
        when(roomRepository.findById(1L)).thenReturn(Optional.of(room));

        when(entityManager.createQuery(anyString(), eq(Long.class))).thenReturn(typedQuery);
        when(typedQuery.setParameter(eq("roomId"), eq(1L))).thenReturn(typedQuery);
        when(typedQuery.setParameter(eq("now"), any())).thenReturn(typedQuery);
        when(typedQuery.getSingleResult()).thenReturn(1L);

        CustomException ex = assertThrows(CustomException.class, () -> roomService.deleteRoom(1L));
        assertEquals("CONFLICT", ex.getErrorCode());
    }
    
    @Test
    void updateSeatMap_DeletesOldAndSavesNew() {
        Room room = new Room();
        when(roomRepository.findById(1L)).thenReturn(Optional.of(room));
        
        SeatMapUpdateRequest request = new SeatMapUpdateRequest();
        request.setRows(5);
        request.setColumns(5);
        request.setSeats(List.of()); // Empty seats list for simplicity

        roomService.updateSeatMap(1L, request);

        verify(roomRepository).save(room);
        verify(seatTemplateRepository).deleteByRoomId(1L);
    }
    @Test
    void getRoomById_WhenExists_ReturnsResponse() {
        Room room = new Room();
        room.setId(1L);

        when(roomRepository.findById(1L)).thenReturn(Optional.of(room));

        RoomResponse mapped = new RoomResponse();
        when(roomMapper.toResponse(room)).thenReturn(mapped);

        RoomResponse result = roomService.getRoomById(1L);

        assertNotNull(result);
    }

    @Test
    void updateRoom_Success() {
        RoomRequest request = new RoomRequest();
        request.setName("Updated Room");
        request.setCinemaId(1L);

        Room room = new Room();
        room.setId(1L);
        
        Cinema cinema = new Cinema();
        cinema.setId(1L);
        room.setCinema(cinema);

        when(roomRepository.findById(1L)).thenReturn(Optional.of(room));
        when(roomRepository.save(any(Room.class))).thenReturn(room);

        RoomResponse mapped = new RoomResponse();
        when(roomMapper.toResponse(room)).thenReturn(mapped);

        RoomResponse result = roomService.updateRoom(1L, request);

        assertNotNull(result);
        verify(roomMapper).updateEntity(room, request);
        verify(roomRepository).save(room);
    }

    @Test
    void getSeatMapByRoomId_ReturnsList() {
        Room room = new Room();
        room.setId(1L);
        
        SeatTemplate template = new SeatTemplate();
        template.setId(1L);
        template.setRoom(room);
        
        SeatType type = new SeatType();
        type.setName("Standard");
        type.setCode(SeatType.SeatTypeCode.STANDARD);
        template.setSeatType(type);

        when(roomRepository.findById(1L)).thenReturn(Optional.of(room));
        when(seatTemplateRepository.findByRoomIdAndActiveTrue(1L))
            .thenReturn(List.of(template));

        List<com.uit.cinema.facility.dto.response.SeatTemplateResponse> result = roomService.getSeatMapByRoomId(1L);

        assertEquals(1, result.size());
    }
}
