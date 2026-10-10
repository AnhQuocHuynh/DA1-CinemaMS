package com.uit.cinema.rental.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.rental.client.RentalClients;
import com.uit.cinema.rental.entity.RentalRoomRate;
import com.uit.cinema.rental.entity.RentalStatus;
import com.uit.cinema.rental.entity.RoomRental;
import com.uit.cinema.rental.repository.RentalRoomRateRepository;
import com.uit.cinema.rental.repository.RoomRentalRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RentalServiceTest {

    @Mock
    private RoomRentalRepository rentals;
    @Mock
    private RentalRoomRateRepository rates;
    @Mock
    private RentalClients.FacilityRoomClient rooms;
    @Mock
    private RentalClients.MovieClient movies;
    @Mock
    private RentalClients.ShowtimeSlotClient showtimes;

    private RentalService service;

    @BeforeEach
    void setUp() {
        service = new RentalService(rentals, rates, rooms, movies, showtimes);
    }

    @Test
    void quote_roundsPartialHourUp() {
        stubAvailableRoom();
        RentalModels.Window window = window(90);

        RentalModels.Quote quote = service.quote(window);

        assertTrue(quote.available());
        assertEquals(2, quote.billedHours());
        assertEquals(new BigDecimal("200.00"), quote.totalAmount());
    }

    @Test
    void quote_whenMovieDoesNotFit_isUnavailable() {
        when(rooms.getRoom(1L)).thenReturn(new RentalClients.FacilityRoom(1L, 3L, "Room 1", true, false));
        when(movies.getMovie(8L)).thenReturn(new RentalClients.MovieFact(8L, 150, true));

        RentalModels.Quote quote = service.quote(new RentalModels.Window(1L, 8L, futureStart(), futureStart().plusMinutes(90)));

        assertFalse(quote.available());
        assertEquals("MOVIE_DOES_NOT_FIT", quote.unavailableCode());
    }

    @Test
    void quote_whenRoomUnderMaintenance_isUnavailable() {
        when(rooms.getRoom(1L)).thenReturn(new RentalClients.FacilityRoom(1L, 3L, "Room 1", true, true));

        RentalModels.Quote quote = service.quote(window(60));

        assertFalse(quote.available());
        assertEquals("ROOM_UNAVAILABLE", quote.unavailableCode());
    }

    @Test
    void approve_staffIsForbidden() {
        RoomRental rental = pending(3L);
        when(rentals.findById(10L)).thenReturn(Optional.of(rental));

        CustomException ex = assertThrows(CustomException.class, () ->
            service.approve(10L, new RentalModels.Actor(4L, "STAFF", List.of(3L))));

        assertEquals("FORBIDDEN", ex.getErrorCode());
        verify(rentals, never()).save(any());
    }

    @Test
    void approve_managerOfAnotherCinemaIsForbidden() {
        when(rentals.findById(10L)).thenReturn(Optional.of(pending(3L)));

        CustomException ex = assertThrows(CustomException.class, () ->
            service.approve(10L, new RentalModels.Actor(4L, "MANAGER", List.of(9L))));

        assertEquals("FORBIDDEN", ex.getErrorCode());
    }

    @Test
    void approve_managerOfCinemaMovesToPayment() {
        when(rentals.findById(10L)).thenReturn(Optional.of(pending(3L)));
        when(rentals.save(any(RoomRental.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RentalModels.RentalView view = service.approve(10L, new RentalModels.Actor(4L, "MANAGER", List.of(3L)));

        assertEquals(RentalStatus.AWAITING_PAYMENT, view.status());
    }

    @Test
    void approve_adminCanApproveAnyCinema() {
        when(rentals.findById(10L)).thenReturn(Optional.of(pending(3L)));
        when(rentals.save(any(RoomRental.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RentalModels.RentalView view = service.approve(10L, new RentalModels.Actor(1L, "ADMIN", List.of()));

        assertEquals(RentalStatus.AWAITING_PAYMENT, view.status());
    }

    @Test
    void create_whenSlotTaken_throwsConflict() {
        when(rooms.getRoom(1L)).thenReturn(new RentalClients.FacilityRoom(1L, 3L, "Room 1", true, false));
        when(rentals.countOverlapping(eq(1L), any(), any(), anyCollection())).thenReturn(1L);

        CustomException ex = assertThrows(CustomException.class, () -> service.create(7L, window(60)));

        assertEquals("ROOM_SLOT_TAKEN", ex.getErrorCode());
        verify(rentals, never()).save(any());
    }

    @Test
    void pay_fromAwaitingPaymentConfirms() {
        RoomRental rental = pending(3L);
        rental.setStatus(RentalStatus.AWAITING_PAYMENT);
        rental.setExpiresAt(LocalDateTime.now().plusMinutes(10));
        when(rentals.findById(10L)).thenReturn(Optional.of(rental));
        when(rentals.save(any(RoomRental.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RentalModels.RentalView view = service.pay(10L, "CASH", new RentalModels.Actor(7L, "CUSTOMER", List.of()));

        assertEquals(RentalStatus.CONFIRMED, view.status());
        assertEquals("CASH", view.paymentMethod());
    }

    private void stubAvailableRoom() {
        when(rooms.getRoom(1L)).thenReturn(new RentalClients.FacilityRoom(1L, 3L, "Room 1", true, false));
        when(showtimes.hasShowtimeOverlap(eq(1L), any(), any())).thenReturn(false);
        when(rentals.countOverlapping(eq(1L), any(), any(), anyCollection())).thenReturn(0L);
        RentalRoomRate rate = new RentalRoomRate();
        rate.setRoomId(1L);
        rate.setPricePerHour(new BigDecimal("100.00"));
        rate.setActive(true);
        when(rates.findById(1L)).thenReturn(Optional.of(rate));
    }

    private RentalModels.Window window(int minutes) {
        LocalDateTime start = futureStart();
        return new RentalModels.Window(1L, null, start, start.plusMinutes(minutes));
    }

    private LocalDateTime futureStart() {
        return LocalDateTime.now().plusDays(2).withNano(0);
    }

    private RoomRental pending(Long cinemaId) {
        RoomRental rental = new RoomRental();
        rental.setUserId(7L);
        rental.setCinemaId(cinemaId);
        rental.setRoomId(1L);
        rental.setStartTime(futureStart());
        rental.setEndTime(futureStart().plusHours(2));
        rental.setPricePerHour(new BigDecimal("100.00"));
        rental.setTotalAmount(new BigDecimal("200.00"));
        rental.setStatus(RentalStatus.PENDING_APPROVAL);
        rental.setExpiresAt(LocalDateTime.now().plusHours(1));
        return rental;
    }
}
