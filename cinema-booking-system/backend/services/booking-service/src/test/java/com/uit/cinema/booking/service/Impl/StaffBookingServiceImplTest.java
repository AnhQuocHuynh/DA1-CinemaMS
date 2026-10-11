package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.dto.request.StaffCounterBookingRequest;
import com.uit.cinema.booking.dto.response.OrderResponse;
import com.uit.cinema.booking.dto.response.StaffDashboardSummaryResponse;
import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.mapper.OrderResponseMapper;
import com.uit.cinema.booking.outbox.BookingOutboxEventWriter;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.repository.VoucherRepository;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatView;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StaffBookingServiceImplTest {

    @Mock
    private OrderRepository orderRepository;
    @Mock
    private TicketRepository ticketRepository;
    @Mock
    private VoucherRepository voucherRepository;
    @Mock
    private SeatReservationService seatReservationService;
    @Mock
    private TicketGenerationService ticketGenerationService;
    @Mock
    private BookingOutboxEventWriter bookingOutboxEventWriter;
    @Mock
    private OrderResponseMapper orderResponseMapper;

    private StaffBookingServiceImpl staffBookingService;

    @BeforeEach
    void setUp() {
        staffBookingService = new StaffBookingServiceImpl(
                orderRepository,
                ticketRepository,
                voucherRepository,
                seatReservationService,
                ticketGenerationService,
                bookingOutboxEventWriter,
                orderResponseMapper
        );
    }

    @Test
    void createCounterBooking_Success() {
        StaffCounterBookingRequest request = StaffCounterBookingRequest.builder()
                .showtimeId(10L)
                .seatIds(List.of(101L, 102L))
                .customerName("Nguyen Van A")
                .customerPhone("0901234567")
                .paymentMethod("CASH")
                .build();

        ShowtimeScheduleView schedule = new ShowtimeScheduleView(
                10L, 1L, null, 1L, LocalDateTime.now(), LocalDateTime.now().plusHours(2), "ACTIVE"
        );
        when(seatReservationService.getSchedule(10L)).thenReturn(schedule);

        List<SeatView> seats = List.of(
                new SeatView(101L, BigDecimal.valueOf(80000)),
                new SeatView(102L, BigDecimal.valueOf(80000))
        );
        when(seatReservationService.bookAvailableSeats(any(SeatBookingRequest.class)))
                .thenReturn(new SeatBookingResult(10L, List.of(101L, 102L), 2, seats));

        Order savedOrder = Order.builder()
                .id(1L)
                .userId(Order.ANONYMOUS_USER_ID)
                .showtimeId(10L)
                .customerName("Nguyen Van A")
                .customerPhone("0901234567")
                .salesChannel(Order.SalesChannel.COUNTER)
                .createdByStaffId(99L)
                .totalAmount(BigDecimal.valueOf(160000))
                .discountAmount(BigDecimal.ZERO)
                .finalAmount(BigDecimal.valueOf(160000))
                .status(Order.OrderStatus.PAID)
                .build();
        when(orderRepository.save(any(Order.class))).thenReturn(savedOrder);

        OrderResponse expectedResponse = OrderResponse.builder()
                .id(1L)
                .customerName("Nguyen Van A")
                .finalAmount(BigDecimal.valueOf(160000))
                .build();
        when(orderResponseMapper.toResponse(savedOrder)).thenReturn(expectedResponse);

        OrderResponse result = staffBookingService.createCounterBooking(request, 99L);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getCustomerName()).isEqualTo("Nguyen Van A");

        verify(ticketGenerationService, times(2)).generateTicket(any(Ticket.class));
        verify(bookingOutboxEventWriter).orderPaid(eq(savedOrder), eq(schedule), eq(2));
    }

    @Test
    void getStaffDashboardSummary_Success() {
        when(orderRepository.countByCreatedAtBetween(any(), any())).thenReturn(5L);
        when(ticketRepository.countByCreatedAtBetween(any(), any())).thenReturn(10L);

        Order order = Order.builder().id(1L).createdAt(LocalDateTime.now()).build();
        when(orderRepository.findByCreatedAtBetweenOrderByCreatedAtDesc(any(), any())).thenReturn(List.of(order));

        StaffDashboardSummaryResponse summary = staffBookingService.getStaffDashboardSummary();

        assertThat(summary.getTodayBookings()).isEqualTo(5L);
        assertThat(summary.getTotalTicketsSold()).isEqualTo(10L);
        assertThat(summary.getPeakHour()).isNotEqualTo("N/A");
    }

    @Test
    void createCounterBooking_WhenSaveFails_CompensatesBookedSeats() {
        StaffCounterBookingRequest request = StaffCounterBookingRequest.builder()
                .showtimeId(10L)
                .seatIds(List.of(101L))
                .customerName("Nguyen Van A")
                .paymentMethod("CASH")
                .build();

        ShowtimeScheduleView schedule = new ShowtimeScheduleView(
                10L, 1L, null, 1L, LocalDateTime.now(), LocalDateTime.now().plusHours(2), "ACTIVE"
        );
        when(seatReservationService.getSchedule(10L)).thenReturn(schedule);
        when(seatReservationService.bookAvailableSeats(any(SeatBookingRequest.class)))
                .thenReturn(new SeatBookingResult(10L, List.of(101L), 1, List.of(new SeatView(101L, BigDecimal.valueOf(80000)))));
        when(orderRepository.save(any(Order.class))).thenThrow(new RuntimeException("Database error"));

        assertThrows(RuntimeException.class, () -> staffBookingService.createCounterBooking(request, 99L));

        verify(seatReservationService).releaseBookedSeats(argThat(r ->
                r.showtimeId().equals(10L) && r.seatIds().contains(101L)
        ));
    }

    @Test
    void getValidationBookings_ReturnsBookingsWithBkPrefix() {
        Order order = Order.builder()
                .id(42L)
                .showtimeId(10L)
                .customerName("Jane Doe")
                .status(Order.OrderStatus.PAID)
                .tickets(List.of(
                        Ticket.builder().ticketCode("TK-TEST1").status(Ticket.TicketStatus.VALID).build()
                ))
                .build();
        when(orderRepository.findByStatusOrderByCreatedAtDesc(Order.OrderStatus.PAID))
                .thenReturn(List.of(order));
        when(orderResponseMapper.toResponse(order))
                .thenReturn(OrderResponse.builder().id(42L).displayTitle("Movie 1").build());

        var result = staffBookingService.getValidationBookings(10);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo("#BK-42");
        assertThat(result.get(0).getCustomerName()).isEqualTo("Jane Doe");
        assertThat(result.get(0).getStatus()).isEqualTo("pending");
    }
}
