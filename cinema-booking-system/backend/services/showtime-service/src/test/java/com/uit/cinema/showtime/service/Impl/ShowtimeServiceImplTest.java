package com.uit.cinema.showtime.service.Impl;

import com.uit.cinema.catalog.service.CatalogReadService;
import com.uit.cinema.catalog.service.contract.CatalogContentView;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.facility.service.FacilityReadService;
import com.uit.cinema.facility.service.contract.FacilityRoomView;
import com.uit.cinema.facility.service.contract.FacilitySeatTemplateView;
import com.uit.cinema.showtime.dto.request.ShowtimeRequest;
import com.uit.cinema.showtime.dto.response.ShowtimeResponse;
import com.uit.cinema.showtime.dto.response.ShowtimeSeatResponse;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.mapper.ShowtimeMapper;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.showtime.service.RentalSlotGuard;
import com.uit.cinema.showtime.service.contract.EventShowtimeCreateRequest;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
    private FacilityReadService facilityReadService;

    @Mock
    private CatalogReadService catalogReadService;

    @Mock
    private RentalSlotGuard rentalSlotGuard;

    @InjectMocks
    private ShowtimeServiceImpl showtimeService;

    @Test
    void getShowtimesByMovie_ReturnsFutureShowtimes() {
        Showtime showtime = new Showtime();
        showtime.setStatus(Showtime.Status.SCHEDULED);
        when(showtimeRepository.findByMovieIdAndStartTimeAfterOrderByStartTimeAsc(eq(1L), any(LocalDateTime.class)))
            .thenReturn(List.of(showtime));
        when(showtimeMapper.toResponse(showtime)).thenReturn(new ShowtimeResponse());

        List<ShowtimeResponse> responses = showtimeService.getShowtimesByMovie(1L);

        assertEquals(1, responses.size());
    }

    @Test
    void createShowtime_WhenNoOverlap_Success() {
        ShowtimeRequest request = movieShowtimeRequest();
        when(catalogReadService.findMovie(1L)).thenReturn(Optional.of(movieContent()));
        when(facilityReadService.findRoom(1L)).thenReturn(Optional.of(room(false)));

        TypedQuery<Long> overlapQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("SELECT COUNT(s)"), eq(Long.class))).thenReturn(overlapQuery);
        when(overlapQuery.setParameter(anyString(), any())).thenReturn(overlapQuery);
        when(overlapQuery.getSingleResult()).thenReturn(0L);

        Showtime showtime = savedShowtime();
        when(showtimeMapper.toEntity(request)).thenReturn(showtime);
        when(showtimeRepository.save(any(Showtime.class))).thenReturn(showtime);
        when(facilityReadService.findActiveSeatTemplatesByRoom(1L)).thenReturn(List.of());
        when(showtimeMapper.toResponse(showtime)).thenReturn(new ShowtimeResponse());

        ShowtimeResponse response = showtimeService.createShowtime(request);

        assertNotNull(response);
        verify(showtimeRepository).save(any(Showtime.class));
    }

    @Test
    void createShowtime_WhenOverlap_ThrowsException() {
        ShowtimeRequest request = movieShowtimeRequest();
        when(catalogReadService.findMovie(1L)).thenReturn(Optional.of(movieContent()));
        when(facilityReadService.findRoom(1L)).thenReturn(Optional.of(room(false)));

        TypedQuery<Long> overlapQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("SELECT COUNT(s)"), eq(Long.class))).thenReturn(overlapQuery);
        when(overlapQuery.setParameter(anyString(), any())).thenReturn(overlapQuery);
        when(overlapQuery.getSingleResult()).thenReturn(1L);

        CustomException ex = assertThrows(CustomException.class, () -> showtimeService.createShowtime(request));

        assertEquals("CONFLICT", ex.getErrorCode());
        verify(showtimeRepository, never()).save(any());
    }

    @Test
    void createShowtime_WhenRentalOverlaps_DoesNotSave() {
        ShowtimeRequest request = movieShowtimeRequest();
        when(catalogReadService.findMovie(1L)).thenReturn(Optional.of(movieContent()));
        when(facilityReadService.findRoom(1L)).thenReturn(Optional.of(room(false)));
        TypedQuery<Long> overlapQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("SELECT COUNT(s)"), eq(Long.class))).thenReturn(overlapQuery);
        when(overlapQuery.setParameter(anyString(), any())).thenReturn(overlapQuery);
        when(overlapQuery.getSingleResult()).thenReturn(0L);
        doThrow(new CustomException("Showtime overlaps a room rental", org.springframework.http.HttpStatus.CONFLICT, "RENTAL_SLOT_TAKEN"))
            .when(rentalSlotGuard).assertSlotFree(eq(1L), any(), any());

        CustomException ex = assertThrows(CustomException.class, () -> showtimeService.createShowtime(request));

        assertEquals("RENTAL_SLOT_TAKEN", ex.getErrorCode());
        verify(showtimeRepository, never()).save(any());
    }

    @Test
    void createShowtime_WhenRentalGuardUnavailable_DoesNotSave() {
        ShowtimeRequest request = movieShowtimeRequest();
        when(catalogReadService.findMovie(1L)).thenReturn(Optional.of(movieContent()));
        when(facilityReadService.findRoom(1L)).thenReturn(Optional.of(room(false)));
        TypedQuery<Long> overlapQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("SELECT COUNT(s)"), eq(Long.class))).thenReturn(overlapQuery);
        when(overlapQuery.setParameter(anyString(), any())).thenReturn(overlapQuery);
        when(overlapQuery.getSingleResult()).thenReturn(0L);
        doThrow(new CustomException("Rental service is unavailable", org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "RENTAL_SERVICE_UNAVAILABLE"))
            .when(rentalSlotGuard).assertSlotFree(eq(1L), any(), any());

        CustomException ex = assertThrows(CustomException.class, () -> showtimeService.createShowtime(request));

        assertEquals("RENTAL_SERVICE_UNAVAILABLE", ex.getErrorCode());
        verify(showtimeRepository, never()).save(any());
    }

    @Test
    void createShowtime_WhenRoomUnderMaintenance_ThrowsException() {
        ShowtimeRequest request = movieShowtimeRequest();
        when(catalogReadService.findMovie(1L)).thenReturn(Optional.of(movieContent()));
        when(facilityReadService.findRoom(1L)).thenReturn(Optional.of(room(true)));

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
        when(facilityReadService.findRoom(1L)).thenReturn(Optional.of(room(false)));
        when(showtimeMapper.toResponse(showtime)).thenReturn(new ShowtimeResponse());

        List<ShowtimeResponse> result = showtimeService.getShowtimesByEvent(1L);

        assertEquals(1, result.size());
    }

    @Test
    void getShowtimesByRoom_ReturnsList() {
        Showtime showtime = new Showtime();
        showtime.setId(1L);
        showtime.setRoomId(1L);

        when(showtimeRepository.findByRoomIdOrderByStartTimeAsc(1L)).thenReturn(List.of(showtime));
        when(facilityReadService.findRoom(1L)).thenReturn(Optional.of(room(false)));
        when(showtimeMapper.toResponse(showtime)).thenReturn(new ShowtimeResponse());

        List<ShowtimeResponse> result = showtimeService.getShowtimesByRoom(1L);

        assertEquals(1, result.size());
    }

    @Test
    void getShowtimeById_WhenExists_ReturnsResponse() {
        Showtime showtime = new Showtime();
        showtime.setId(1L);
        showtime.setRoomId(1L);

        when(showtimeRepository.findById(1L)).thenReturn(Optional.of(showtime));
        when(facilityReadService.findRoom(1L)).thenReturn(Optional.of(room(false)));
        when(showtimeMapper.toResponse(showtime)).thenReturn(new ShowtimeResponse());

        ShowtimeResponse result = showtimeService.getShowtimeById(1L);

        assertNotNull(result);
    }

    @Test
    void getSeatMap_ReturnsSeatList() {
        ShowtimeSeat seat = seat();
        when(showtimeSeatRepository.findByShowtimeId(1L)).thenReturn(List.of(seat));
        when(facilityReadService.findSeatTemplate(5L)).thenReturn(Optional.of(seatTemplate()));
        when(showtimeMapper.toSeatResponse(any(ShowtimeSeat.class))).thenReturn(new ShowtimeSeatResponse());

        List<ShowtimeSeatResponse> result = showtimeService.getSeatMap(1L);

        assertEquals(1, result.size());
    }

    @Test
    void getSeatById_WhenExists_ReturnsResponse() {
        ShowtimeSeat seat = seat();
        when(showtimeSeatRepository.findById(10L)).thenReturn(Optional.of(seat));
        when(facilityReadService.findSeatTemplate(5L)).thenReturn(Optional.of(seatTemplate()));
        when(showtimeMapper.toSeatResponse(any(ShowtimeSeat.class))).thenReturn(new ShowtimeSeatResponse());

        ShowtimeSeatResponse result = showtimeService.getSeatById(10L);

        assertNotNull(result);
    }

    @Test
    void hasFutureShowtimesForRoom_WhenRepositoryFindsMatch_ReturnsTrue() {
        when(showtimeRepository.existsByRoomIdAndStartTimeAfterAndStatusNot(
            eq(1L),
            any(LocalDateTime.class),
            eq(Showtime.Status.CANCELLED)
        )).thenReturn(true);

        boolean result = showtimeService.hasFutureShowtimesForRoom(1L);

        assertTrue(result);
    }

    @Test
    void hasFutureShowtimesForRooms_WhenRoomIdsEmpty_ReturnsFalse() {
        boolean result = showtimeService.hasFutureShowtimesForRooms(List.of());

        assertFalse(result);
    }

    @Test
    void createShowtimeForEvent_SkipsCatalogLookupAndCreatesShowtime() {
        EventShowtimeCreateRequest request = new EventShowtimeCreateRequest(
            9L,
            1L,
            LocalDateTime.now().plusDays(1),
            LocalDateTime.now().plusDays(1).plusHours(2),
            BigDecimal.valueOf(50000)
        );
        when(facilityReadService.findRoom(1L)).thenReturn(Optional.of(room(false)));

        TypedQuery<Long> overlapQuery = mock(TypedQuery.class);
        when(entityManager.createQuery(contains("SELECT COUNT(s)"), eq(Long.class))).thenReturn(overlapQuery);
        when(overlapQuery.setParameter(anyString(), any())).thenReturn(overlapQuery);
        when(overlapQuery.getSingleResult()).thenReturn(0L);

        Showtime showtime = savedShowtime();
        showtime.setEventId(9L);
        showtime.setMovieId(null);
        when(showtimeMapper.toEntity(any(ShowtimeRequest.class))).thenReturn(showtime);
        when(showtimeRepository.save(any(Showtime.class))).thenReturn(showtime);
        when(facilityReadService.findActiveSeatTemplatesByRoom(1L)).thenReturn(List.of());
        when(showtimeMapper.toResponse(showtime)).thenReturn(new ShowtimeResponse());

        ShowtimeResponse response = showtimeService.createShowtimeForEvent(request);

        assertNotNull(response);
        verify(catalogReadService, never()).findEvent(any());
        verify(showtimeRepository).save(any(Showtime.class));
    }

    @Test
    void deleteFutureShowtimesByEvent_DeletesNonCancelledFutureShowtimes() {
        Showtime scheduled = new Showtime();
        scheduled.setId(20L);
        scheduled.setStatus(Showtime.Status.SCHEDULED);
        Showtime cancelled = new Showtime();
        cancelled.setId(21L);
        cancelled.setStatus(Showtime.Status.CANCELLED);
        when(showtimeRepository.findByEventIdAndStartTimeAfterOrderByStartTimeAsc(eq(9L), any(LocalDateTime.class)))
            .thenReturn(List.of(scheduled, cancelled));

        showtimeService.deleteFutureShowtimesByEvent(9L);

        verify(showtimeSeatRepository).deleteByShowtimeId(20L);
        verify(showtimeRepository).deleteById(20L);
        verify(showtimeSeatRepository, never()).deleteByShowtimeId(21L);
        verify(showtimeRepository, never()).deleteById(21L);
    }

    @Test
    void findActiveSchedule_mapsActiveShowtimes() {
        Showtime showtime = new Showtime();
        showtime.setId(2L);
        showtime.setMovieId(1L);
        showtime.setRoomId(3L);
        showtime.setStartTime(LocalDateTime.of(2026, 11, 4, 10, 0));
        showtime.setEndTime(LocalDateTime.of(2026, 11, 4, 12, 0));
        showtime.setStatus(Showtime.Status.SCHEDULED);
        when(showtimeRepository.findActiveIntersecting(eq(3L), any(), any(), eq(Showtime.Status.CANCELLED)))
            .thenReturn(List.of(showtime));

        List<ShowtimeScheduleView> schedule = showtimeService.findActiveSchedule(
            3L,
            LocalDateTime.of(2026, 11, 4, 9, 0),
            LocalDateTime.of(2026, 11, 4, 13, 0)
        );

        assertEquals(1, schedule.size());
        assertEquals(2L, schedule.get(0).showtimeId());
        assertEquals("SCHEDULED", schedule.get(0).status());
    }

    private ShowtimeRequest movieShowtimeRequest() {
        ShowtimeRequest request = new ShowtimeRequest();
        request.setMovieId(1L);
        request.setRoomId(1L);
        request.setStartTime(LocalDateTime.now().plusDays(1));
        request.setEndTime(LocalDateTime.now().plusDays(1).plusHours(2));
        request.setBasePrice(BigDecimal.valueOf(50000));
        return request;
    }

    private Showtime savedShowtime() {
        Showtime showtime = new Showtime();
        showtime.setId(10L);
        showtime.setMovieId(1L);
        showtime.setRoomId(1L);
        showtime.setBasePrice(BigDecimal.valueOf(50000));
        return showtime;
    }

    private CatalogContentView movieContent() {
        return new CatalogContentView(1L, "Movie 1", "MOVIE", LocalDate.now().minusDays(1));
    }

    private FacilityRoomView room(boolean underMaintenance) {
        return new FacilityRoomView(1L, "Room 1", 2L, "Cinema 1", underMaintenance);
    }

    private FacilitySeatTemplateView seatTemplate() {
        return new FacilitySeatTemplateView(
            5L,
            "A",
            1,
            "standard",
            "STANDARD",
            "Standard",
            1,
            false,
            BigDecimal.ONE
        );
    }

    private ShowtimeSeat seat() {
        ShowtimeSeat seat = new ShowtimeSeat();
        seat.setId(10L);
        seat.setShowtimeId(1L);
        seat.setSeatTemplateId(5L);
        seat.setStatus(ShowtimeSeat.SeatStatus.AVAILABLE);
        return seat;
    }
}
