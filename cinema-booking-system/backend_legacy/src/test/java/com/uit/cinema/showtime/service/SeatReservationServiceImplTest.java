package com.uit.cinema.showtime.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SeatReservationServiceImplTest {

    @Mock
    private ShowtimeSeatRepository showtimeSeatRepository;

    @InjectMocks
    private SeatReservationServiceImpl seatReservationService;

    @Test
    void validateHeldSeats_Success() {
        SeatBookingRequest request = new SeatBookingRequest(1L, 1L, List.of(10L, 11L));
        
        ShowtimeSeat seat1 = ShowtimeSeat.builder().id(10L).showtimeId(1L).status(ShowtimeSeat.SeatStatus.HELD).price(BigDecimal.TEN).build();
        ShowtimeSeat seat2 = ShowtimeSeat.builder().id(11L).showtimeId(1L).status(ShowtimeSeat.SeatStatus.HELD).price(BigDecimal.TEN).build();

        when(showtimeSeatRepository.findAllById(List.of(10L, 11L))).thenReturn(List.of(seat1, seat2));

        SeatHoldValidationResult result = seatReservationService.validateHeldSeats(request);

        assertEquals(2, result.seats().size());
        assertEquals(new BigDecimal("20"), result.totalAmount());
    }

    @Test
    void validateHeldSeats_SeatNotHeld_ThrowsException() {
        SeatBookingRequest request = new SeatBookingRequest(1L, 1L, List.of(10L));
        
        ShowtimeSeat seat1 = ShowtimeSeat.builder().id(10L).showtimeId(1L).status(ShowtimeSeat.SeatStatus.AVAILABLE).price(BigDecimal.TEN).build();

        when(showtimeSeatRepository.findAllById(List.of(10L))).thenReturn(List.of(seat1));

        CustomException ex = assertThrows(CustomException.class, () -> seatReservationService.validateHeldSeats(request));
        assertEquals("SEAT_NOT_HELD", ex.getErrorCode());
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
    }

    @Test
    void confirmHeldSeats_Success() {
        SeatBookingRequest request = new SeatBookingRequest(1L, 1L, List.of(10L));
        
        ShowtimeSeat seat1 = ShowtimeSeat.builder().id(10L).showtimeId(1L).status(ShowtimeSeat.SeatStatus.HELD).price(BigDecimal.TEN).build();

        when(showtimeSeatRepository.findAllById(List.of(10L))).thenReturn(List.of(seat1));

        SeatBookingResult result = seatReservationService.confirmHeldSeats(request);

        assertEquals(1, result.affectedRows());
        assertEquals(ShowtimeSeat.SeatStatus.BOOKED, seat1.getStatus());
        verify(showtimeSeatRepository).saveAll(anyList());
    }

    @Test
    void releaseHeldSeats_Success() {
        SeatBookingRequest request = new SeatBookingRequest(1L, 1L, List.of(10L));
        
        ShowtimeSeat seat1 = ShowtimeSeat.builder().id(10L).showtimeId(1L).status(ShowtimeSeat.SeatStatus.HELD).price(BigDecimal.TEN).build();

        when(showtimeSeatRepository.findAllById(List.of(10L))).thenReturn(List.of(seat1));

        seatReservationService.releaseHeldSeats(request);

        assertEquals(ShowtimeSeat.SeatStatus.AVAILABLE, seat1.getStatus());
        verify(showtimeSeatRepository).saveAll(anyList());
    }
}
