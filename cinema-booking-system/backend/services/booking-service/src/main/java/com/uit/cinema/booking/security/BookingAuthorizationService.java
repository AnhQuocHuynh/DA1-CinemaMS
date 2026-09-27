package com.uit.cinema.booking.security;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BookingAuthorizationService {

    private final AuthenticatedUserIdResolver userIdResolver;
    private final OrderRepository orderRepository;
    private final TicketRepository ticketRepository;

    @Transactional(readOnly = true)
    public void requireOrderAccess(Long orderId) {
        if (!userIdResolver.isJwtEnabled() || userIdResolver.hasAnyRole("ADMIN", "STAFF")) {
            return;
        }

        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new CustomException("Order not found", HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND"));
        requireOwner(order.getUserId());
    }

    @Transactional(readOnly = true)
    public void requireTicketAccess(String ticketCode) {
        if (!userIdResolver.isJwtEnabled() || userIdResolver.hasAnyRole("ADMIN", "STAFF")) {
            return;
        }

        Ticket ticket = ticketRepository.findByTicketCode(ticketCode)
            .orElseThrow(() -> new CustomException("Ticket not found", HttpStatus.NOT_FOUND, "TICKET_NOT_FOUND"));
        requireOwner(ticket.getOrder().getUserId());
    }

    private void requireOwner(Long ownerUserId) {
        if (!userIdResolver.currentUserId().equals(ownerUserId)) {
            throw new CustomException(
                "The authenticated user does not own this booking resource",
                HttpStatus.FORBIDDEN,
                "BOOKING_ACCESS_DENIED"
            );
        }
    }
}
