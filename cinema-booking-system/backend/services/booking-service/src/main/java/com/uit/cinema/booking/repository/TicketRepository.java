package com.uit.cinema.booking.repository;

import com.uit.cinema.booking.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {

    Optional<Ticket> findByTicketCode(String ticketCode);

    List<Ticket> findByOrderUserIdOrderByCreatedAtDesc(Long userId);

    List<Ticket> findByOrderIdOrderByCreatedAtDesc(Long orderId);
}
