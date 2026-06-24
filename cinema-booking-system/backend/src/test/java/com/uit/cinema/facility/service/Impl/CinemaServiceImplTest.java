package com.uit.cinema.facility.service.Impl;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.facility.dto.request.CinemaRequest;
import com.uit.cinema.facility.dto.response.CinemaResponse;
import com.uit.cinema.facility.entity.Cinema;
import com.uit.cinema.facility.entity.Room;
import com.uit.cinema.facility.mapper.CinemaMapper;
import com.uit.cinema.facility.repository.CinemaRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CinemaServiceImplTest {

    @Mock
    private CinemaRepository cinemaRepository;

    @Mock
    private CinemaMapper cinemaMapper;

    @Mock
    private EntityManager entityManager;

    @Mock
    private TypedQuery<Long> typedQuery;

    @InjectMocks
    private CinemaServiceImpl cinemaService;

    @Test
    void getAllActiveCinemas_ReturnsList() {
        Cinema cinema = new Cinema();
        when(cinemaRepository.findByActiveTrue()).thenReturn(List.of(cinema));
        when(cinemaMapper.toResponse(cinema)).thenReturn(new CinemaResponse());

        List<CinemaResponse> responses = cinemaService.getAllActiveCinemas();

        assertEquals(1, responses.size());
    }

    @Test
    void getCinemaById_WhenExists_ReturnsResponse() {
        Cinema cinema = new Cinema();
        when(cinemaRepository.findById(1L)).thenReturn(Optional.of(cinema));
        when(cinemaMapper.toResponse(cinema)).thenReturn(new CinemaResponse());

        CinemaResponse response = cinemaService.getCinemaById(1L);

        assertNotNull(response);
    }

    @Test
    void getCinemaById_WhenNotExists_ThrowsException() {
        when(cinemaRepository.findById(1L)).thenReturn(Optional.empty());

        CustomException ex = assertThrows(CustomException.class, () -> cinemaService.getCinemaById(1L));
        assertEquals("CINEMA_NOT_FOUND", ex.getErrorCode());
    }

    @Test
    void createCinema_Success() {
        CinemaRequest request = new CinemaRequest();
        Cinema cinema = new Cinema();
        when(cinemaMapper.toEntity(request)).thenReturn(cinema);
        when(cinemaRepository.save(any(Cinema.class))).thenReturn(cinema);
        when(cinemaMapper.toResponse(cinema)).thenReturn(new CinemaResponse());

        CinemaResponse response = cinemaService.createCinema(request);

        assertNotNull(response);
        verify(cinemaRepository).save(any(Cinema.class));
    }

    @Test
    void deleteCinema_WhenNoFutureShowtimes_SoftDeletes() {
        Cinema cinema = new Cinema();
        cinema.setActive(true);
        
        Room room = new Room();
        room.setId(10L);
        room.setActive(true);
        cinema.setRooms(List.of(room));

        when(cinemaRepository.findById(1L)).thenReturn(Optional.of(cinema));

        when(entityManager.createQuery(anyString(), eq(Long.class))).thenReturn(typedQuery);
        when(typedQuery.setParameter(eq("roomIds"), anyList())).thenReturn(typedQuery);
        when(typedQuery.setParameter(eq("now"), any())).thenReturn(typedQuery);
        when(typedQuery.getSingleResult()).thenReturn(0L); // No future showtimes

        cinemaService.deleteCinema(1L);

        assertFalse(cinema.isActive());
        verify(cinemaRepository).save(cinema);
    }

    @Test
    void deleteCinema_WhenFutureShowtimesExist_ThrowsException() {
        Cinema cinema = new Cinema();
        cinema.setActive(true);
        
        Room room = new Room();
        room.setId(10L);
        room.setActive(true);
        cinema.setRooms(List.of(room));

        when(cinemaRepository.findById(1L)).thenReturn(Optional.of(cinema));

        when(entityManager.createQuery(anyString(), eq(Long.class))).thenReturn(typedQuery);
        when(typedQuery.setParameter(eq("roomIds"), anyList())).thenReturn(typedQuery);
        when(typedQuery.setParameter(eq("now"), any())).thenReturn(typedQuery);
        when(typedQuery.getSingleResult()).thenReturn(1L); // 1 future showtime exists

        CustomException ex = assertThrows(CustomException.class, () -> cinemaService.deleteCinema(1L));
        assertEquals("CONFLICT", ex.getErrorCode());
    }
    @Test
    void updateCinema_Success() {
        CinemaRequest request = new CinemaRequest();
        request.setName("New Cinema Name");

        Cinema cinema = new Cinema();
        cinema.setId(1L);

        when(cinemaRepository.findById(1L)).thenReturn(Optional.of(cinema));
        when(cinemaRepository.save(any(Cinema.class))).thenReturn(cinema);
        
        CinemaResponse mapped = new CinemaResponse();
        when(cinemaMapper.toResponse(cinema)).thenReturn(mapped);

        CinemaResponse result = cinemaService.updateCinema(1L, request);

        assertNotNull(result);
        verify(cinemaMapper).updateEntity(cinema, request);
        verify(cinemaRepository).save(cinema);
    }
}
