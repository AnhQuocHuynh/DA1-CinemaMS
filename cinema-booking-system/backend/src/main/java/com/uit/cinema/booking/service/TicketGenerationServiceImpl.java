package com.uit.cinema.booking.service;

import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Tạo mã vé, QR Code và xuất PDF.
 * Tích hợp thư viện QR (ZXing) và PDF (iText / Flying Saucer) ở bước triển khai tiếp theo.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TicketGenerationServiceImpl implements TicketGenerationService {

    private final TicketRepository ticketRepository;

    @Override
    @Transactional
    public Ticket generateTicket(Ticket ticket) {
        String code = "TK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        ticket.setTicketCode(code);
        ticket.setQrCodeData(buildQrData(code, ticket.getShowtimeSeatId()));
        return ticketRepository.save(ticket);
    }

    @Override
    public Ticket checkIn(String ticketCode) {
        Ticket ticket = ticketRepository.findByTicketCode(ticketCode)
            .orElseThrow(() -> new CustomException("Mã vé không hợp lệ", HttpStatus.NOT_FOUND, "TICKET_NOT_FOUND"));
        if (ticket.getStatus() != Ticket.TicketStatus.VALID) {
            throw new CustomException("Vé đã được sử dụng hoặc đã hủy", HttpStatus.BAD_REQUEST, "TICKET_NOT_VALID");
        }
        ticket.setStatus(Ticket.TicketStatus.USED);
        ticket.setCheckedInAt(java.time.LocalDateTime.now());
        log.info("Checked in ticket: {}", ticketCode);
        return ticketRepository.save(ticket);
    }

    private String buildQrData(String code, Long seatId) {
        return "CINEMA|" + code + "|SEAT:" + seatId;
    }
}
