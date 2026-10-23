package com.uit.cinema.rental.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.rental.client.RentalClients;
import com.uit.cinema.rental.entity.RefundStatus;
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
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RentalServiceTest {

    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-28T03:00:00Z"), ZONE);

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
    @Mock
    private RentalNotifier notifier;

    private RentalService service;

    @BeforeEach
    void setUp() {
        service = new RentalService(rentals, rates, rooms, movies, showtimes, CLOCK, RentalRules.neutral(), notifier);
    }

    @Test
    void quote_roundsPartialHourUpAndPadsTurnover() {
        stubAvailableRoom();
        RentalModels.Window window = window(90);

        RentalModels.Quote quote = service.quote(window);

        assertTrue(quote.available());
        assertEquals(2, quote.billedHours());
        assertEquals(new BigDecimal("200.00"), quote.totalAmount());
        verify(showtimes).hasShowtimeOverlap(1L, window.startTime().minusMinutes(15), window.endTime().plusMinutes(15));
        verify(rentals).countOverlapping(
            eq(1L),
            eq(window.startTime().minusMinutes(15)),
            eq(window.endTime().plusMinutes(15)),
            anyCollection()
        );
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
    void quote_whenRateMissing_usesDefaultPrice() {
        when(rooms.getRoom(1L)).thenReturn(new RentalClients.FacilityRoom(1L, 3L, "Room 1", true, false));
        when(showtimes.hasShowtimeOverlap(eq(1L), any(), any())).thenReturn(false);
        when(rentals.countOverlapping(eq(1L), any(), any(), anyCollection())).thenReturn(0L);
        when(rates.findById(1L)).thenReturn(Optional.empty());

        RentalModels.Quote quote = service.quote(window(90));

        assertTrue(quote.available());
        assertEquals(new BigDecimal("300000.00"), quote.totalAmount());
    }

    @Test
    void quote_appliesWeekendAndPeakMultipliers() {
        RentalRules pricedRules = new RentalRules(15, 24, new BigDecimal("150000.00"), new BigDecimal("1.5"), new BigDecimal("1.2"), 18, 22);
        RentalService priced = new RentalService(rentals, rates, rooms, movies, showtimes, CLOCK, pricedRules, notifier);
        when(rooms.getRoom(1L)).thenReturn(new RentalClients.FacilityRoom(1L, 3L, "Room 1", true, false));
        when(showtimes.hasShowtimeOverlap(eq(1L), any(), any())).thenReturn(false);
        when(rentals.countOverlapping(eq(1L), any(), any(), anyCollection())).thenReturn(0L);
        RentalRoomRate rate = new RentalRoomRate();
        rate.setRoomId(1L);
        rate.setPricePerHour(new BigDecimal("100.00"));
        rate.setActive(true);
        when(rates.findById(1L)).thenReturn(Optional.of(rate));
        LocalDateTime start = LocalDateTime.of(2026, 10, 31, 19, 0);

        RentalModels.Quote quote = priced.quote(new RentalModels.Window(1L, null, start, start.plusMinutes(90)));

        assertEquals(new BigDecimal("180.00"), quote.pricePerHour());
        assertEquals(new BigDecimal("360.00"), quote.totalAmount());
    }

    @Test
    void quote_rejectsVietnamPastWallTime() {
        CustomException ex = assertThrows(CustomException.class, () ->
            service.quote(new RentalModels.Window(1L, null, LocalDateTime.of(2026, 10, 28, 9, 0), LocalDateTime.of(2026, 10, 28, 11, 0))));

        assertEquals("INVALID_WINDOW", ex.getErrorCode());
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
        when(showtimes.hasShowtimeOverlap(eq(1L), any(), any())).thenReturn(false);
        when(rentals.save(any(RoomRental.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RentalModels.RentalView view = service.approve(10L, new RentalModels.Actor(4L, "MANAGER", List.of(3L)));

        assertEquals(RentalStatus.AWAITING_PAYMENT, view.status());
        verify(notifier).statusChanged(eq(7L), any(), any(), any());
    }

    @Test
    void approve_whenShowtimeOverlaps_throwsConflict() {
        when(rentals.findById(10L)).thenReturn(Optional.of(pending(3L)));
        when(showtimes.hasShowtimeOverlap(eq(1L), any(), any())).thenReturn(true);

        CustomException ex = assertThrows(CustomException.class, () ->
            service.approve(10L, new RentalModels.Actor(1L, "ADMIN", List.of())));

        assertEquals("SHOWTIME_OVERLAP", ex.getErrorCode());
        verify(rentals, never()).save(any());
    }

    @Test
    void approve_adminCanApproveAnyCinema() {
        when(rentals.findById(10L)).thenReturn(Optional.of(pending(3L)));
        when(showtimes.hasShowtimeOverlap(eq(1L), any(), any())).thenReturn(false);
        when(rentals.save(any(RoomRental.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RentalModels.RentalView view = service.approve(10L, new RentalModels.Actor(1L, "ADMIN", List.of()));

        assertEquals(RentalStatus.AWAITING_PAYMENT, view.status());
    }

    @Test
    void create_whenSlotTaken_throwsConflict() {
        when(rooms.getRoom(1L)).thenReturn(new RentalClients.FacilityRoom(1L, 3L, "Room 1", true, false));
        when(showtimes.hasShowtimeOverlap(eq(1L), any(), any())).thenReturn(false);
        when(rentals.countOverlapping(eq(1L), any(), any(), anyCollection())).thenReturn(1L);

        CustomException ex = assertThrows(CustomException.class, () -> service.create(7L, window(60)));

        assertEquals("ROOM_SLOT_TAKEN", ex.getErrorCode());
        verify(rentals, never()).save(any());
    }

    @Test
    void create_whenNotifierThrows_stillReturnsPending() {
        stubAvailableRoom();
        when(rentals.save(any(RoomRental.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new RuntimeException("notification down")).when(notifier).statusChanged(any(), any(), any(), any());

        RentalModels.RentalView view = service.create(7L, window(60));

        assertEquals(RentalStatus.PENDING_APPROVAL, view.status());
        assertEquals(RefundStatus.NONE, view.refundStatus());
    }

    @Test
    void pay_customerCashDoesNotConfirm() {
        RoomRental rental = awaitingPayment();
        when(rentals.findById(10L)).thenReturn(Optional.of(rental));

        CustomException ex = assertThrows(CustomException.class, () ->
            service.pay(10L, "CASH", new RentalModels.Actor(7L, "CUSTOMER", List.of())));

        assertEquals("CASH_COUNTER_ONLY", ex.getErrorCode());
        verify(rentals, never()).save(any());
    }

    @Test
    void pay_customerOnlineStaysAwaitingPayment() {
        when(rentals.findById(10L)).thenReturn(Optional.of(awaitingPayment()));
        when(rentals.save(any(RoomRental.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RentalModels.RentalView view = service.pay(10L, "vnpay", new RentalModels.Actor(7L, "CUSTOMER", List.of()));

        assertEquals(RentalStatus.AWAITING_PAYMENT, view.status());
        assertEquals("VNPAY", view.paymentMethod());
    }

    @Test
    void pay_managerCashConfirmsAfterShowtimeCheck() {
        RoomRental rental = awaitingPayment();
        when(rentals.findById(10L)).thenReturn(Optional.of(rental));
        when(showtimes.hasShowtimeOverlap(eq(1L), any(), any())).thenReturn(false);
        when(rentals.save(any(RoomRental.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RentalModels.RentalView view = service.pay(10L, "CASH", new RentalModels.Actor(4L, "MANAGER", List.of(3L)));

        assertEquals(RentalStatus.CONFIRMED, view.status());
        assertEquals("CASH", view.paymentMethod());
        verify(showtimes).hasShowtimeOverlap(1L, rental.getStartTime().minusMinutes(15), rental.getEndTime().plusMinutes(15));
    }

    @Test
    void cancel_customerInside24HoursIsRejected() {
        RoomRental rental = confirmed(now().plusHours(10));
        when(rentals.findById(10L)).thenReturn(Optional.of(rental));

        CustomException ex = assertThrows(CustomException.class, () ->
            service.cancel(10L, new RentalModels.Actor(7L, "CUSTOMER", List.of())));

        assertEquals("CUSTOMER_CANCEL_WINDOW_CLOSED", ex.getErrorCode());
    }

    @Test
    void cancel_customerOutside24HoursRecordsPendingRefund() {
        when(rentals.findById(10L)).thenReturn(Optional.of(confirmed(futureStart())));
        when(rentals.save(any(RoomRental.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RentalModels.RentalView view = service.cancel(10L, new RentalModels.Actor(7L, "CUSTOMER", List.of()));

        assertEquals(RentalStatus.CANCELLED, view.status());
        assertEquals(RefundStatus.PENDING, view.refundStatus());
        assertEquals(new BigDecimal("200.00"), view.refundAmount());
    }

    @Test
    void cancel_managerBeforeStartRecordsPendingRefund() {
        when(rentals.findById(10L)).thenReturn(Optional.of(confirmed(now().plusHours(2))));
        when(rentals.save(any(RoomRental.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RentalModels.RentalView view = service.cancel(10L, new RentalModels.Actor(4L, "MANAGER", List.of(3L)));

        assertEquals(RentalStatus.CANCELLED, view.status());
        assertEquals(RefundStatus.PENDING, view.refundStatus());
    }

    @Test
    void availability_padsBlockingRentalAndShowtime() {
        when(rooms.getRoom(1L)).thenReturn(new RentalClients.FacilityRoom(1L, 3L, "Room 1", true, false));
        when(rates.findById(1L)).thenReturn(Optional.empty());
        RoomRental rental = confirmed(LocalDateTime.of(2026, 11, 2, 10, 0));
        rental.setEndTime(LocalDateTime.of(2026, 11, 2, 12, 0));
        when(rentals.findBlockingForRoom(eq(1L), any(), any(), anyCollection())).thenReturn(List.of(rental));
        when(showtimes.activeShowtimes(eq(1L), any(), any())).thenReturn(List.of(
            new RentalClients.ShowtimeSlot(
                LocalDateTime.of(2026, 11, 2, 14, 0),
                LocalDateTime.of(2026, 11, 2, 16, 0),
                "SCHEDULED"
            )
        ));

        RentalModels.Availability availability = service.availability(
            1L,
            LocalDateTime.of(2026, 11, 2, 0, 0),
            LocalDateTime.of(2026, 11, 3, 0, 0)
        );

        assertEquals(new BigDecimal("150000.00"), availability.pricePerHour());
        assertEquals(2, availability.busy().size());
        assertEquals(LocalDateTime.of(2026, 11, 2, 9, 45), availability.busy().get(0).startTime());
        assertEquals(LocalDateTime.of(2026, 11, 2, 12, 15), availability.busy().get(0).endTime());
        assertEquals("SHOWTIME", availability.busy().get(1).source());
        assertEquals(LocalDateTime.of(2026, 11, 2, 13, 45), availability.busy().get(1).startTime());
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

    private LocalDateTime now() {
        return LocalDateTime.now(CLOCK);
    }

    private LocalDateTime futureStart() {
        return now().plusDays(2).withNano(0);
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
        rental.setRefundStatus(RefundStatus.NONE);
        rental.setExpiresAt(now().plusHours(1));
        return rental;
    }

    private RoomRental awaitingPayment() {
        RoomRental rental = pending(3L);
        rental.setStatus(RentalStatus.AWAITING_PAYMENT);
        rental.setExpiresAt(now().plusMinutes(10));
        return rental;
    }

    private RoomRental confirmed(LocalDateTime start) {
        RoomRental rental = pending(3L);
        rental.setStatus(RentalStatus.CONFIRMED);
        rental.setStartTime(start);
        rental.setEndTime(start.plusHours(2));
        rental.setExpiresAt(null);
        return rental;
    }
}
