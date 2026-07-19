package com.uit.cinema.booking.service;

import com.uit.cinema.booking.entity.Ticket;

/**
 * Tạo mã vé, QR Code và xuất PDF.
 * Tích hợp thư viện QR (ZXing) và PDF (iText / Flying Saucer) ở bước triển khai tiếp theo.
 */
public interface TicketGenerationService {
    Ticket generateTicket(Ticket ticket);
    Ticket checkIn(String ticketCode);
}
