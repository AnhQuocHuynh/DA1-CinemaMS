package com.uit.cinema.booking.controller;

import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.service.TicketGenerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TicketGenerationService ticketGenerationService;

    @PostMapping("/check-in")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public ResponseEntity<Ticket> checkIn(@RequestBody Map<String, String> request) {
        return ResponseEntity.ok(ticketGenerationService.checkIn(request.get("ticketCode")));
    }
}
