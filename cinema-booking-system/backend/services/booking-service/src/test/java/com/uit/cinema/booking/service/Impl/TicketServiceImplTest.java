package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.dto.response.TicketResponse;
import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.mapper.TicketMapper;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.catalog.service.CatalogReadService;
import com.uit.cinema.facility.service.FacilityReadService;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import com.uit.cinema.showtime.service.contract.ShowtimeSeatView;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketServiceImplTest {

    @Mock
    private TicketRepository ticketRepository;
    @Mock
    private TicketGenerationService ticketGenerationService;
    @Mock
    private TicketMapper ticketMapper;
    @Mock
    private SeatReservationService seatReservationService;
    @Mock
    private CatalogReadService catalogReadService;
    @Mock
    private FacilityReadService facilityReadService;

    @InjectMocks
    private TicketServiceImpl ticketService;

    @Test
    void getByCode_shouldMarkRefundable100_whenShowtimeMoreThan24h() {
        Ticket ticket = Ticket.builder()
            .id(1L)
            .order(Order.builder().id(100L).userId(200L).build())
            .showtimeSeatId(10L)
            .price(BigDecimal.TEN)
            .status(Ticket.TicketStatus.VALID)
            .build();
        TicketResponse mapped = new TicketResponse();
        mapped.setId(1L);
        mapped.setOrderId(100L);
        mapped.setUserId(200L);
        mapped.setShowtimeSeatId(10L);
        mapped.setStatus(Ticket.TicketStatus.VALID);

        ShowtimeSeatView seat = new ShowtimeSeatView(10L, 30L, 40L, BigDecimal.TEN, "BOOKED");
        ShowtimeScheduleView showtime = new ShowtimeScheduleView(
            30L,
            1L,
            null,
            2L,
            LocalDateTime.now().plusHours(30),
            LocalDateTime.now().plusHours(32),
            "SCHEDULED"
        );

        when(ticketRepository.findByTicketCode("TK-1")).thenReturn(Optional.of(ticket));
        when(ticketMapper.toResponse(ticket)).thenReturn(mapped);
        when(seatReservationService.findSeat(10L)).thenReturn(Optional.of(seat));
        when(seatReservationService.findSchedule(30L)).thenReturn(Optional.of(showtime));

        TicketResponse result = ticketService.getByCode("TK-1");

        assertTrue(result.getRefundable());
        assertEquals(100, result.getRefundPercent());
    }

    @Test
    void getByCode_shouldMarkNotRefundable_whenTicketNotValid() {
        Ticket ticket = Ticket.builder()
            .id(2L)
            .order(Order.builder().id(101L).userId(201L).build())
            .showtimeSeatId(11L)
            .price(BigDecimal.TEN)
            .status(Ticket.TicketStatus.CHECKED_IN)
            .build();
        TicketResponse mapped = new TicketResponse();
        mapped.setId(2L);
        mapped.setStatus(Ticket.TicketStatus.CHECKED_IN);
        mapped.setShowtimeSeatId(11L);

        when(ticketRepository.findByTicketCode("TK-2")).thenReturn(Optional.of(ticket));
        when(ticketMapper.toResponse(ticket)).thenReturn(mapped);

        TicketResponse result = ticketService.getByCode("TK-2");
        assertFalse(result.getRefundable());
        assertEquals(0, result.getRefundPercent());
    }

    @Test
    void checkIn_Success() {
        Ticket ticket = Ticket.builder()
            .id(1L)
            .status(Ticket.TicketStatus.CHECKED_IN)
            .showtimeSeatId(11L)
            .build();

        TicketResponse mapped = new TicketResponse();
        mapped.setId(1L);
        mapped.setStatus(Ticket.TicketStatus.CHECKED_IN);
        mapped.setShowtimeSeatId(11L);

        when(ticketGenerationService.checkIn("TK-1")).thenReturn(ticket);
        when(ticketMapper.toResponse(ticket)).thenReturn(mapped);

        TicketResponse result = ticketService.checkIn("TK-1");

        assertEquals(Ticket.TicketStatus.CHECKED_IN, result.getStatus());
        assertFalse(result.getRefundable());
    }

    @Test
    void getByUserId_ReturnsList() {
        Ticket ticket = Ticket.builder()
            .id(1L)
            .status(Ticket.TicketStatus.VALID)
            .showtimeSeatId(11L)
            .build();

        TicketResponse mapped = new TicketResponse();
        mapped.setId(1L);
        mapped.setStatus(Ticket.TicketStatus.VALID);
        mapped.setShowtimeSeatId(11L);

        when(ticketRepository.findByOrderUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(ticket));
        when(ticketMapper.toResponse(ticket)).thenReturn(mapped);

        List<TicketResponse> result = ticketService.getByUserId(1L);

        assertEquals(1, result.size());
    }

    @Test
    void getByOrderId_ReturnsList() {
        Ticket ticket = Ticket.builder()
            .id(1L)
            .status(Ticket.TicketStatus.VALID)
            .showtimeSeatId(11L)
            .build();

        TicketResponse mapped = new TicketResponse();
        mapped.setId(1L);
        mapped.setStatus(Ticket.TicketStatus.VALID);
        mapped.setShowtimeSeatId(11L);

        when(ticketRepository.findByOrderIdOrderByCreatedAtDesc(101L)).thenReturn(List.of(ticket));
        when(ticketMapper.toResponse(ticket)).thenReturn(mapped);

        List<TicketResponse> result = ticketService.getByOrderId(101L);

        assertEquals(1, result.size());
    }
}
