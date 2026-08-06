package com.uit.cinema.showtime.service.Impl;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.showtime.service.SeatHoldPolicy;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SeatLockingServiceImplTest {

    @Mock
    private RedisTemplate<String, Object> redisTemplate;

    @Mock
    private ValueOperations<String, Object> valueOperations;

    @Mock
    private ShowtimeSeatRepository showtimeSeatRepository;

    @InjectMocks
    private SeatLockingServiceImpl seatLockingService;

    @Test
    void holdSeats_WhenAvailable_Success() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(anyString(), eq("1"), any())).thenReturn(true);

        ShowtimeSeat seat = new ShowtimeSeat();
        seat.setStatus(ShowtimeSeat.SeatStatus.AVAILABLE);
        when(showtimeSeatRepository.findById(10L)).thenReturn(Optional.of(seat));

        seatLockingService.holdSeats(1L, List.of(10L), 1L);

        assertEquals(ShowtimeSeat.SeatStatus.HELD, seat.getStatus());
        verify(showtimeSeatRepository).save(seat);
    }

    @Test
    void holdSeats_WhenAlreadyHeldBySameUser_RefreshesTTL() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(anyString(), eq("1"), any())).thenReturn(false);
        when(valueOperations.get(anyString())).thenReturn("1");

        seatLockingService.holdSeats(1L, List.of(10L), 1L);

        verify(redisTemplate).expire(anyString(), any());
    }

    @Test
    void holdSeats_WhenHeldByAnotherUser_ThrowsException() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(anyString(), eq("1"), any())).thenReturn(false);
        when(valueOperations.get(anyString())).thenReturn("2"); // Held by user 2

        CustomException ex = assertThrows(CustomException.class, () -> seatLockingService.holdSeats(1L, List.of(10L), 1L));
        assertEquals("SEAT_ALREADY_HELD", ex.getErrorCode());
    }

    @Test
    void holdSeats_WhenNotAvailableInDB_ThrowsExceptionAndReleasesLock() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(anyString(), eq("1"), any())).thenReturn(true);

        ShowtimeSeat seat = new ShowtimeSeat();
        seat.setStatus(ShowtimeSeat.SeatStatus.BOOKED); // Seat is sold!
        when(showtimeSeatRepository.findById(10L)).thenReturn(Optional.of(seat));

        CustomException ex = assertThrows(CustomException.class, () -> seatLockingService.holdSeats(1L, List.of(10L), 1L));
        
        assertEquals("SEAT_NOT_AVAILABLE", ex.getErrorCode());
        verify(redisTemplate).delete(anyString()); // Lock must be deleted
    }

    @Test
    void releaseHold_DeletesKeysAndUpdatesStatus() {
        ShowtimeSeat seat = new ShowtimeSeat();
        seat.setStatus(ShowtimeSeat.SeatStatus.HELD);
        when(showtimeSeatRepository.findById(10L)).thenReturn(Optional.of(seat));

        seatLockingService.releaseHold(1L, 10L);

        assertEquals(ShowtimeSeat.SeatStatus.AVAILABLE, seat.getStatus());
        verify(showtimeSeatRepository).save(seat);
        verify(redisTemplate).delete(anyString());
    }

    @Test
    void releaseHold_WithOwner_AtomicallyDeletesOwnedLock() {
        ShowtimeSeat seat = new ShowtimeSeat();
        seat.setStatus(ShowtimeSeat.SeatStatus.HELD);
        when(showtimeSeatRepository.findById(10L)).thenReturn(Optional.of(seat));
        when(redisTemplate.execute(any(), anyList(), eq("1"))).thenReturn(1L);

        seatLockingService.releaseHold(1L, 10L, 1L);

        assertEquals(ShowtimeSeat.SeatStatus.AVAILABLE, seat.getStatus());
        verify(showtimeSeatRepository).save(seat);
    }

    @Test
    void releaseHold_WhenHeldByAnotherUser_RejectsRequest() {
        when(redisTemplate.execute(any(), anyList(), eq("1"))).thenReturn(0L);
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(anyString())).thenReturn("2");

        CustomException exception = assertThrows(
            CustomException.class,
            () -> seatLockingService.releaseHold(1L, 10L, 1L)
        );

        assertEquals("SEAT_HOLD_ACCESS_DENIED", exception.getErrorCode());
        verify(showtimeSeatRepository, never()).save(any());
    }
}
