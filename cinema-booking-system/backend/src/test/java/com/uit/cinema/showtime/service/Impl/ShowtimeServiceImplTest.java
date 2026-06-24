package com.uit.cinema.showtime.service.Impl;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.facility.dto.response.RoomResponse;
import com.uit.cinema.facility.entity.SeatTemplate;
import com.uit.cinema.facility.service.RoomService;
import com.uit.cinema.showtime.dto.request.ShowtimeRequest;
import com.uit.cinema.showtime.dto.response.ShowtimeResponse;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.dto.response.ShowtimeSeatResponse;
import com.uit.cinema.facility.entity.SeatTemplate;
import com.uit.cinema.facility.entity.SeatType;
import com.uit.cinema.facility.repository.SeatTemplateRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.mapper.ShowtimeMapper;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShowtimeServiceImplTest {

    @Mock
    private ShowtimeRepository showtimeRepository;

    @Mock
    private ShowtimeSeatRepository showtimeSeatRepository;

    @Mock
    private ShowtimeMapper showtimeMapper;

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private EntityManager entityManager;

    @Mock
    private RoomService roomService;

    @Mock
    private TypedQuery<Long> typedQuery;

    @Mock
    private SeatTemplateRepository seatTemplateRepository;

    @InjectMocks
    private ShowtimeServiceImpl showtimeService;

    @Test
    void getShowtimesByMovie_ReturnsFutureShowtimes() {
        Showtime showtime = new Showtime();
        showtime.setStatus(Showtime.Status.SCHEDULED);
        when(showtimeRepository.findByMovieIdAndStartTimeAfterOrderByStartTimeAsc(eq(1L), any(LocalDateTime.class)))
                .thenReturn(List.of(showtime));
        
        ShowtimeResponse mockResp = new ShowtimeResponse();
        when(showtimeMapper.toResponse(showtime)).thenReturn(mockResp);

        List<ShowtimeResponse> responses = showtimeService.getShowtimesByMovie(1L);

        assertEquals(1, responses.size());
    }

    @Test
    void createShowtime_WhenNoOverlap_Success() {
        ShowtimeRequest request = new ShowtimeRequest();
        request.setMovieId(1L);
        request.setRoomId(1L);
        request.setStartTime(LocalDateTime.now().plusDays(1));
        request.setEndTime(LocalDateTime.now().plusDays(1).plusHours(2));
        request.setBasePrice(BigDecimal.valueOf(50000));

        RoomResponse roomResp = new RoomResponse();
        roomResp.setActive(true);
        when(roomService.getRoomById(1L)).thenReturn(roomResp);

        // No need to mock overlap check since we use mock(TypedQuery.class) which returns 0L by default for Long.class
        TypedQuery<Long> overlapQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("SELECT COUNT(s)"), eq(Long.class))).thenReturn(overlapQuery);
        when(overlapQuery.setParameter(anyString(), any())).thenReturn(overlapQuery);
        when(overlapQuery.getSingleResult()).thenReturn(0L);

        Showtime showtime = new Showtime();
        showtime.setId(10L);
        when(showtimeMapper.toEntity(request)).thenReturn(showtime);
        when(showtimeRepository.save(any(Showtime.class))).thenReturn(showtime);
        when(showtimeMapper.toResponse(showtime)).thenReturn(new ShowtimeResponse());

        // Mock Seat Templates query
        TypedQuery templateQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("SELECT t"), eq(SeatTemplate.class))).thenReturn(templateQuery);
        when(templateQuery.setParameter(anyString(), any())).thenReturn(templateQuery);
        when(templateQuery.getResultList()).thenReturn(List.of());

        ShowtimeResponse response = showtimeService.createShowtime(request);

        assertNotNull(response);
        verify(showtimeRepository).save(any(Showtime.class));
    }

    @Test
    void createShowtime_WhenOverlap_ThrowsException() {
        ShowtimeRequest request = new ShowtimeRequest();
        request.setMovieId(1L);
        request.setRoomId(1L);
        request.setStartTime(LocalDateTime.now().plusDays(1));
        request.setEndTime(LocalDateTime.now().plusDays(1).plusHours(2));

        RoomResponse roomResp = new RoomResponse();
        roomResp.setActive(true);
        when(roomService.getRoomById(1L)).thenReturn(roomResp);

        TypedQuery<Long> overlapQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("SELECT COUNT(s)"), eq(Long.class))).thenReturn(overlapQuery);
        when(overlapQuery.setParameter(anyString(), any())).thenReturn(overlapQuery);
        when(overlapQuery.getSingleResult()).thenReturn(1L); // Overlap exists!

        CustomException ex = assertThrows(CustomException.class, () -> showtimeService.createShowtime(request));
        assertEquals("CONFLICT", ex.getErrorCode());
    }

    @Test
    void createShowtime_WhenRoomUnderMaintenance_ThrowsException() {
        ShowtimeRequest request = new ShowtimeRequest();
        request.setMovieId(1L);
        request.setRoomId(1L);
        request.setStartTime(LocalDateTime.now().plusDays(1));
        request.setEndTime(LocalDateTime.now().plusDays(1).plusHours(2));

        RoomResponse roomResp = new RoomResponse();
        roomResp.setUnderMaintenance(true);
        when(roomService.getRoomById(1L)).thenReturn(roomResp);

        CustomException ex = assertThrows(CustomException.class, () -> showtimeService.createShowtime(request));
        assertEquals("ROOM_UNDER_MAINTENANCE", ex.getErrorCode());
    }

    @Test
    void deleteShowtime_Success() {
        when(showtimeRepository.existsById(1L)).thenReturn(true);
        
        showtimeService.deleteShowtime(1L);
        
        verify(showtimeSeatRepository).deleteByShowtimeId(1L);
        verify(showtimeRepository).deleteById(1L);
    }
    @Test
    void getShowtimesByEvent_ReturnsFutureShowtimes() {
        Showtime showtime = new Showtime();
        showtime.setId(1L);
        showtime.setStatus(Showtime.Status.SCHEDULED);
        showtime.setRoomId(1L);

        when(showtimeRepository.findByEventIdAndStartTimeAfterOrderByStartTimeAsc(eq(1L), any(LocalDateTime.class)))
            .thenReturn(List.of(showtime));

        RoomResponse roomResp = new RoomResponse();
        roomResp.setName("Room 1");
        when(roomService.getRoomById(1L)).thenReturn(roomResp);

        ShowtimeResponse response = new ShowtimeResponse();
        when(showtimeMapper.toResponse(showtime)).thenReturn(response);

        List<ShowtimeResponse> result = showtimeService.getShowtimesByEvent(1L);

        assertEquals(1, result.size());
    }

    @Test
    void getShowtimesByRoom_ReturnsList() {
        Showtime showtime = new Showtime();
        showtime.setId(1L);
        showtime.setRoomId(1L);

        when(showtimeRepository.findByRoomIdOrderByStartTimeAsc(1L)).thenReturn(List.of(showtime));

        RoomResponse roomResp = new RoomResponse();
        roomResp.setName("Room 1");
        when(roomService.getRoomById(1L)).thenReturn(roomResp);

        ShowtimeResponse response = new ShowtimeResponse();
        when(showtimeMapper.toResponse(showtime)).thenReturn(response);

        List<ShowtimeResponse> result = showtimeService.getShowtimesByRoom(1L);

        assertEquals(1, result.size());
    }

    @Test
    void getShowtimeById_WhenExists_ReturnsResponse() {
        Showtime showtime = new Showtime();
        showtime.setId(1L);
        showtime.setRoomId(1L);

        when(showtimeRepository.findById(1L)).thenReturn(Optional.of(showtime));

        RoomResponse roomResp = new RoomResponse();
        roomResp.setName("Room 1");
        when(roomService.getRoomById(1L)).thenReturn(roomResp);

        ShowtimeResponse response = new ShowtimeResponse();
        when(showtimeMapper.toResponse(showtime)).thenReturn(response);

        ShowtimeResponse result = showtimeService.getShowtimeById(1L);

        assertNotNull(result);
    }

    @Test
    void getSeatMap_ReturnsSeatList() {
        ShowtimeSeat seat = new ShowtimeSeat();
        seat.setId(10L);
        seat.setShowtimeId(1L);
        seat.setSeatTemplateId(5L);

        when(showtimeSeatRepository.findByShowtimeId(1L)).thenReturn(List.of(seat));

        SeatTemplate template = new SeatTemplate();
        template.setRowLabel("A");
        template.setColumnNumber(1);
        SeatType type = new SeatType();
        type.setName("Standard");
        template.setSeatType(type);
        when(seatTemplateRepository.findById(5L)).thenReturn(Optional.of(template));
        when(showtimeMapper.toSeatResponse(any(ShowtimeSeat.class))).thenReturn(new ShowtimeSeatResponse());

        List<ShowtimeSeatResponse> result = showtimeService.getSeatMap(1L);

        assertEquals(1, result.size());
    }

    @Test
    void getSeatById_WhenExists_ReturnsResponse() {
        ShowtimeSeat seat = new ShowtimeSeat();
        seat.setId(10L);
        seat.setShowtimeId(1L);
        seat.setSeatTemplateId(5L);

        when(showtimeSeatRepository.findById(10L)).thenReturn(Optional.of(seat));

        SeatTemplate template = new SeatTemplate();
        template.setRowLabel("A");
        template.setColumnNumber(1);
        SeatType type = new SeatType();
        type.setName("Standard");
        template.setSeatType(type);
        when(seatTemplateRepository.findById(5L)).thenReturn(Optional.of(template));
        when(showtimeMapper.toSeatResponse(any(ShowtimeSeat.class))).thenReturn(new ShowtimeSeatResponse());

        ShowtimeSeatResponse result = showtimeService.getSeatById(10L);

        assertNotNull(result);
    }
}
