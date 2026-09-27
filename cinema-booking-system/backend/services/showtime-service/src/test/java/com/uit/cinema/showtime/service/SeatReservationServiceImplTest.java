package com.uit.cinema.showtime.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;
import com.uit.cinema.showtime.service.contract.SeatReleaseRequest;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatReservationServiceImplTest {

    @Mock
    private ShowtimeSeatRepository showtimeSeatRepository;
    @Mock
    private ShowtimeRepository showtimeRepository;
    @Mock
    private RedisTemplate<String, Object> redisTemplate;
    @Mock
    private ValueOperations<String, Object> valueOperations;

    @InjectMocks
    private SeatReservationServiceImpl seatReservationService;

    @Test
    void validateHeldSeats_Success() {
        SeatBookingRequest request = new SeatBookingRequest(1L, 1L, List.of(10L, 11L));
        ShowtimeSeat seat1 = heldSeat(10L);
        ShowtimeSeat seat2 = heldSeat(11L);

        when(showtimeSeatRepository.findAllById(List.of(10L, 11L))).thenReturn(List.of(seat1, seat2));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(SeatHoldPolicy.holdKey(1L, 10L))).thenReturn("1");
        when(valueOperations.get(SeatHoldPolicy.holdKey(1L, 11L))).thenReturn("1");

        SeatHoldValidationResult result = seatReservationService.validateHeldSeats(request);

        assertEquals(2, result.seats().size());
        assertEquals(new BigDecimal("20"), result.totalAmount());
    }

    @Test
    void validateHeldSeats_SeatNotHeld_ThrowsException() {
        SeatBookingRequest request = new SeatBookingRequest(1L, 1L, List.of(10L));
        ShowtimeSeat seat = ShowtimeSeat.builder()
            .id(10L)
            .showtimeId(1L)
            .status(ShowtimeSeat.SeatStatus.AVAILABLE)
            .price(BigDecimal.TEN)
            .build();

        when(showtimeSeatRepository.findAllById(List.of(10L))).thenReturn(List.of(seat));

        CustomException ex = assertThrows(CustomException.class, () -> seatReservationService.validateHeldSeats(request));
        assertEquals("SEAT_NOT_HELD", ex.getErrorCode());
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
    }

    @Test
    void validateHeldSeats_HoldOwnerMismatch_ThrowsException() {
        SeatBookingRequest request = new SeatBookingRequest(1L, 1L, List.of(10L));
        when(showtimeSeatRepository.findAllById(List.of(10L))).thenReturn(List.of(heldSeat(10L)));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(SeatHoldPolicy.holdKey(1L, 10L))).thenReturn("2");

        CustomException ex = assertThrows(CustomException.class, () -> seatReservationService.validateHeldSeats(request));
        assertEquals("SEAT_HOLD_INVALID", ex.getErrorCode());
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
    }

    @Test
    void confirmHeldSeats_Success() {
        SeatBookingRequest request = new SeatBookingRequest(1L, 1L, List.of(10L));
        ShowtimeSeat seat = heldSeat(10L);

        when(showtimeSeatRepository.findAllById(List.of(10L))).thenReturn(List.of(seat));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(SeatHoldPolicy.holdKey(1L, 10L))).thenReturn("1");

        SeatBookingResult result = seatReservationService.confirmHeldSeats(request);

        assertEquals(1, result.affectedRows());
        assertEquals(ShowtimeSeat.SeatStatus.BOOKED, seat.getStatus());
        assertEquals(1, result.seats().size());
        verify(showtimeSeatRepository).saveAll(anyList());
        verify(redisTemplate).delete(SeatHoldPolicy.holdKey(1L, 10L));
    }

    @Test
    void bookAvailableSeats_Success() {
        SeatBookingRequest request = new SeatBookingRequest(1L, 1L, List.of(10L));
        ShowtimeSeat seat = ShowtimeSeat.builder()
            .id(10L)
            .showtimeId(1L)
            .status(ShowtimeSeat.SeatStatus.AVAILABLE)
            .price(BigDecimal.TEN)
            .build();

        when(showtimeSeatRepository.findAllById(List.of(10L))).thenReturn(List.of(seat));

        SeatBookingResult result = seatReservationService.bookAvailableSeats(request);

        assertEquals(1, result.affectedRows());
        assertEquals(ShowtimeSeat.SeatStatus.BOOKED, seat.getStatus());
        verify(showtimeSeatRepository).saveAll(anyList());
    }

    @Test
    void releaseHeldSeats_Success() {
        SeatBookingRequest request = new SeatBookingRequest(1L, 1L, List.of(10L));
        ShowtimeSeat seat = heldSeat(10L);

        when(showtimeSeatRepository.findAllById(List.of(10L))).thenReturn(List.of(seat));

        seatReservationService.releaseHeldSeats(request);

        assertEquals(ShowtimeSeat.SeatStatus.AVAILABLE, seat.getStatus());
        verify(showtimeSeatRepository).saveAll(anyList());
        verify(redisTemplate).delete(SeatHoldPolicy.holdKey(1L, 10L));
    }

    @Test
    void releaseBookedSeats_Success() {
        SeatReleaseRequest request = new SeatReleaseRequest(1L, List.of(10L));
        ShowtimeSeat seat = ShowtimeSeat.builder()
            .id(10L)
            .showtimeId(1L)
            .status(ShowtimeSeat.SeatStatus.BOOKED)
            .price(BigDecimal.TEN)
            .build();

        when(showtimeSeatRepository.findAllById(List.of(10L))).thenReturn(List.of(seat));

        seatReservationService.releaseBookedSeats(request);

        assertEquals(ShowtimeSeat.SeatStatus.AVAILABLE, seat.getStatus());
        verify(showtimeSeatRepository).saveAll(anyList());
    }

    @Test
    void getSchedule_ReturnsProjection() {
        Showtime showtime = Showtime.builder()
            .id(1L)
            .movieId(2L)
            .roomId(3L)
            .startTime(LocalDateTime.now().plusHours(1))
            .endTime(LocalDateTime.now().plusHours(3))
            .status(Showtime.Status.SCHEDULED)
            .build();
        when(showtimeRepository.findById(1L)).thenReturn(Optional.of(showtime));

        ShowtimeScheduleView result = seatReservationService.getSchedule(1L);

        assertEquals(1L, result.showtimeId());
        assertEquals(2L, result.movieId());
        assertEquals("SCHEDULED", result.status());
    }

    private ShowtimeSeat heldSeat(Long seatId) {
        return ShowtimeSeat.builder()
            .id(seatId)
            .showtimeId(1L)
            .status(ShowtimeSeat.SeatStatus.HELD)
            .price(BigDecimal.TEN)
            .build();
    }
}
