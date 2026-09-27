package com.uit.cinema.staff.service.impl;

import com.uit.cinema.booking.dto.response.OrderResponse;
import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.mapper.OrderResponseMapper;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.VoucherRepository;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.iam.entity.User;
import com.uit.cinema.iam.repository.UserRepository;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;
import com.uit.cinema.showtime.service.contract.SeatView;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import com.uit.cinema.staff.dto.request.StaffCounterBookingRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StaffBookingServiceImplTest {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private VoucherRepository voucherRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TicketGenerationService ticketGenerationService;
    @Mock
    private OrderResponseMapper orderResponseMapper;
    @Mock
    private SeatReservationService seatReservationService;

    @InjectMocks
    private StaffBookingServiceImpl staffBookingService;

    @Test
    void createCounterBooking_happyPath_usesSeatReservationBoundary() {
        StaffCounterBookingRequest request = new StaffCounterBookingRequest();
        request.setShowtimeId(100L);
        request.setSeatIds(List.of(55L));
        request.setPaymentMethod("cash");
        request.setCustomerName("Walk-in");

        ShowtimeScheduleView schedule = new ShowtimeScheduleView(
            100L,
            1L,
            null,
            2L,
            LocalDateTime.now().plusHours(2),
            LocalDateTime.now().plusHours(4),
            "SCHEDULED"
        );
        User walkInUser = User.builder()
            .id(999L)
            .email("walkin@cinema.local")
            .build();
        OrderResponse response = OrderResponse.builder()
            .id(10L)
            .status(Order.OrderStatus.PAID)
            .build();

        when(seatReservationService.getSchedule(100L)).thenReturn(schedule);
        when(seatReservationService.validateAvailableSeats(any()))
            .thenReturn(new SeatHoldValidationResult(List.of(new SeatView(55L, new BigDecimal("100.00"))), new BigDecimal("100.00")));
        when(userRepository.findByEmail("walkin@cinema.local")).thenReturn(Optional.of(walkInUser));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order saved = invocation.getArgument(0);
            saved.setId(10L);
            return saved;
        });
        when(seatReservationService.bookAvailableSeats(any()))
            .thenReturn(new SeatBookingResult(100L, List.of(55L), 1, List.of(new SeatView(55L, new BigDecimal("100.00")))));
        when(ticketGenerationService.generateTicket(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(orderResponseMapper.toResponse(any(Order.class))).thenReturn(response);

        OrderResponse result = staffBookingService.createCounterBooking(request, 7L);

        assertEquals(10L, result.getId());
        assertEquals(Order.OrderStatus.PAID, result.getStatus());
        verify(seatReservationService).validateAvailableSeats(any());
        verify(seatReservationService).bookAvailableSeats(any());
        verify(ticketGenerationService).generateTicket(any(Ticket.class));
    }
}
