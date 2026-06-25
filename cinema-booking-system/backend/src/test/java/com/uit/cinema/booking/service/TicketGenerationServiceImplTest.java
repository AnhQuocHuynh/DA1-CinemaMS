package com.uit.cinema.booking.service;

import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.booking.service.Impl.TicketGenerationServiceImpl;
import com.uit.cinema.core.exception.CustomException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketGenerationServiceImplTest {

    @Mock
    private TicketRepository ticketRepository;

    @InjectMocks
    private TicketGenerationServiceImpl ticketService;

    @Test
    void generateTicket_happyPath_setsCodeAndQrThenSaves() {
        Ticket ticket = Ticket.builder()
            .showtimeSeatId(55L)
            .price(new BigDecimal("80.00"))
            .build();

        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Ticket result = ticketService.generateTicket(ticket);

        assertNotNull(result.getTicketCode());
        assertTrue(result.getTicketCode().startsWith("TK-"));
        assertTrue(result.getTicketCode().length() > 3);
        assertEquals("CINEMA|" + result.getTicketCode() + "|SEAT:55", result.getQrCodeData());
        verify(ticketRepository).save(ticket);
    }

    @Test
    void checkIn_happyPath_marksTicketUsed() {
        Ticket ticket = Ticket.builder()
            .ticketCode("TK-ABCDEFGH")
            .showtimeSeatId(55L)
            .price(new BigDecimal("80.00"))
            .status(Ticket.TicketStatus.VALID)
            .build();

        when(ticketRepository.findByTicketCode("TK-ABCDEFGH")).thenReturn(Optional.of(ticket));
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Ticket result = ticketService.checkIn("TK-ABCDEFGH");

        assertEquals(Ticket.TicketStatus.CHECKED_IN, result.getStatus());
        assertNotNull(result.getCheckedInAt());
        verify(ticketRepository).save(ticket);
    }

    @Test
    void checkIn_whenTicketNotFound_throwsNotFound() {
        when(ticketRepository.findByTicketCode("TK-NOTFOUND")).thenReturn(Optional.empty());

        CustomException ex = assertThrows(
            CustomException.class,
            () -> ticketService.checkIn("TK-NOTFOUND")
        );

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        assertEquals("TICKET_NOT_FOUND", ex.getErrorCode());
    }

    @Test
    void checkIn_whenTicketNotValid_throwsBadRequest() {
        Ticket ticket = Ticket.builder()
            .ticketCode("TK-USED")
            .showtimeSeatId(55L)
            .price(new BigDecimal("80.00"))
            .status(Ticket.TicketStatus.CHECKED_IN)
            .build();

        when(ticketRepository.findByTicketCode("TK-USED")).thenReturn(Optional.of(ticket));

        CustomException ex = assertThrows(
            CustomException.class,
            () -> ticketService.checkIn("TK-USED")
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("TICKET_NOT_VALID", ex.getErrorCode());
    }
}
