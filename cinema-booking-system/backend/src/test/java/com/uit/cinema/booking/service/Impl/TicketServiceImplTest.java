package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.dto.response.TicketResponse;
import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.mapper.TicketMapper;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.service.TicketGenerationService;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
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
    private ShowtimeSeatRepository showtimeSeatRepository;
    @Mock
    private ShowtimeRepository showtimeRepository;

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

        ShowtimeSeat seat = ShowtimeSeat.builder().id(10L).showtimeId(30L).build();
        Showtime showtime = Showtime.builder()
            .id(30L)
            .startTime(LocalDateTime.now().plusHours(30))
            .endTime(LocalDateTime.now().plusHours(32))
            .build();

        when(ticketRepository.findByTicketCode("TK-1")).thenReturn(Optional.of(ticket));
        when(ticketMapper.toResponse(ticket)).thenReturn(mapped);
        when(showtimeSeatRepository.findById(10L)).thenReturn(Optional.of(seat));
        when(showtimeRepository.findById(30L)).thenReturn(Optional.of(showtime));

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
}
