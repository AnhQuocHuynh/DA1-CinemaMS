package com.uit.cinema.booking.controller;

import com.uit.cinema.booking.dto.response.TicketResponse;
import com.uit.cinema.booking.security.AuthenticatedUserIdResolver;
import com.uit.cinema.booking.security.BookingAuthorizationService;
import com.uit.cinema.booking.service.TicketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TicketService ticketService;
    private final AuthenticatedUserIdResolver userIdResolver;
    private final BookingAuthorizationService authorizationService;

    @PostMapping("/check-in")
    @PreAuthorize("hasRole('STAFF') or hasRole('ADMIN')")
    public ResponseEntity<TicketResponse> checkIn(@RequestBody Map<String, String> request) {
        return ResponseEntity.ok(ticketService.checkIn(request.get("ticketCode")));
    }

    @GetMapping("/code/{ticketCode}")
    public ResponseEntity<TicketResponse> getByCode(@PathVariable String ticketCode) {
        authorizationService.requireTicketAccess(ticketCode);
        return ResponseEntity.ok(ticketService.getByCode(ticketCode));
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<List<TicketResponse>> getByUser(@PathVariable Long userId) {
        Long authorizedUserId = userIdResolver.authorizeRequestedUser(userId);
        return ResponseEntity.ok(ticketService.getByUserId(authorizedUserId));
    }

    @GetMapping("/orders/{orderId}")
    public ResponseEntity<List<TicketResponse>> getByOrder(@PathVariable Long orderId) {
        authorizationService.requireOrderAccess(orderId);
        return ResponseEntity.ok(ticketService.getByOrderId(orderId));
    }
}
