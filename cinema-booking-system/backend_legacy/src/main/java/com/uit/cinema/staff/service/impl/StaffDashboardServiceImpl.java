package com.uit.cinema.staff.service.impl;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.catalog.entity.Event;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.EventRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.iam.entity.User;
import com.uit.cinema.iam.repository.UserRepository;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.staff.dto.response.StaffBookingResponse;
import com.uit.cinema.staff.dto.response.StaffDashboardSummaryResponse;
import com.uit.cinema.staff.dto.response.StaffValidationStatsResponse;
import com.uit.cinema.staff.service.StaffDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StaffDashboardServiceImpl implements StaffDashboardService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter SHOWTIME_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final OrderRepository orderRepository;
    private final TicketRepository ticketRepository;
    private final ShowtimeRepository showtimeRepository;
    private final MovieRepository movieRepository;
    private final EventRepository eventRepository;
    private final UserRepository userRepository;

    @Override
    public StaffDashboardSummaryResponse getSummary() {
        LocalDate today = LocalDate.now();
        List<Order> todayPaidOrders = findPaidOrdersCreatedOn(today);
        long ticketsSold = todayPaidOrders.stream()
            .flatMap(order -> order.getTickets().stream())
            .filter(this::isActiveTicket)
            .count();

        return StaffDashboardSummaryResponse.builder()
            .todayBookings(todayPaidOrders.size())
            .totalTicketsSold(ticketsSold)
            .peakHour(calculatePeakHour(todayPaidOrders))
            .build();
    }

    @Override
    public List<StaffBookingResponse> getTodayBookings(int limit) {
        return findPaidOrdersCreatedOn(LocalDate.now()).stream()
            .sorted(Comparator.comparing(this::effectiveOrderTime, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
            .limit(safeLimit(limit, 10))
            .map(this::toBookingResponse)
            .toList();
    }

    @Override
    public StaffValidationStatsResponse getValidationStats() {
        List<Ticket> todayShowtimeTickets = findTicketsForShowtimesOn(LocalDate.now());
        long totalValidated = todayShowtimeTickets.stream()
            .filter(ticket -> ticket.getStatus() == Ticket.TicketStatus.CHECKED_IN)
            .count();
        long pendingCheckIns = todayShowtimeTickets.stream()
            .filter(ticket -> ticket.getStatus() == Ticket.TicketStatus.VALID)
            .count();

        return StaffValidationStatsResponse.builder()
            .totalValidated(totalValidated)
            .pendingCheckIns(pendingCheckIns)
            .totalBookings(totalValidated + pendingCheckIns)
            .validatorsOnline(1)
            .build();
    }

    @Override
    public List<StaffBookingResponse> getValidationBookings(int limit) {
        return orderRepository.findByStatus(Order.OrderStatus.PAID).stream()
            .filter(order -> showtimeRepository.findById(order.getShowtimeId())
                .map(showtime -> isSameDay(showtime.getStartTime(), LocalDate.now()))
                .orElse(false))
            .sorted(Comparator.comparing(this::showtimeStart, Comparator.nullsLast(Comparator.naturalOrder())))
            .limit(safeLimit(limit, 20))
            .map(this::toValidationBookingResponse)
            .toList();
    }

    private List<Order> findPaidOrdersCreatedOn(LocalDate date) {
        return orderRepository.findByStatus(Order.OrderStatus.PAID).stream()
            .filter(order -> isSameDay(effectiveOrderTime(order), date))
            .toList();
    }

    private List<Ticket> findTicketsForShowtimesOn(LocalDate date) {
        return ticketRepository.findAll().stream()
            .filter(this::isActiveTicket)
            .filter(ticket -> {
                Order order = ticket.getOrder();
                if (order == null || order.getStatus() != Order.OrderStatus.PAID) {
                    return false;
                }
                return showtimeRepository.findById(order.getShowtimeId())
                    .map(showtime -> isSameDay(showtime.getStartTime(), date))
                    .orElse(false);
            })
            .toList();
    }

    private StaffBookingResponse toBookingResponse(Order order) {
        Showtime showtime = showtimeRepository.findById(order.getShowtimeId()).orElse(null);
        String customerName = Optional.ofNullable(order.getCustomerName())
            .filter(name -> !name.isBlank())
            .orElseGet(() -> userRepository.findById(order.getUserId())
                .map(User::getFullName)
                .filter(name -> !name.isBlank())
                .orElse("Customer #" + order.getUserId()));
        String movieTitle = resolveShowtimeTitle(showtime);

        return StaffBookingResponse.builder()
            .id("#BK-" + order.getId())
            .customer(customerName)
            .customerName(customerName)
            .movieTitle(movieTitle)
            .time(formatTime(effectiveOrderTime(order)))
            .showtime(formatShowtime(showtime))
            .seats(activeTicketCount(order))
            .status("confirmed")
            .build();
    }

    private StaffBookingResponse toValidationBookingResponse(Order order) {
        StaffBookingResponse response = toBookingResponse(order);
        response.setTime(formatShowtime(showtimeRepository.findById(order.getShowtimeId()).orElse(null)));
        response.setStatus(hasUncheckedTickets(order) ? "pending" : "validated");
        return response;
    }

    private boolean hasUncheckedTickets(Order order) {
        List<Ticket> activeTickets = order.getTickets().stream()
            .filter(this::isActiveTicket)
            .toList();
        return activeTickets.isEmpty()
            || activeTickets.stream().anyMatch(ticket -> ticket.getStatus() == Ticket.TicketStatus.VALID);
    }

    private String resolveShowtimeTitle(Showtime showtime) {
        if (showtime == null) {
            return "Unknown showtime";
        }
        if (showtime.getMovieId() != null) {
            return movieRepository.findById(showtime.getMovieId())
                .map(Movie::getTitle)
                .orElse("Movie #" + showtime.getMovieId());
        }
        if (showtime.getEventId() != null) {
            return eventRepository.findById(showtime.getEventId())
                .map(Event::getName)
                .orElse("Event #" + showtime.getEventId());
        }
        return "Showtime #" + showtime.getId();
    }

    private int activeTicketCount(Order order) {
        return (int) order.getTickets().stream()
            .filter(this::isActiveTicket)
            .count();
    }

    private boolean isActiveTicket(Ticket ticket) {
        return ticket != null
            && ticket.getStatus() != Ticket.TicketStatus.CANCELLED
            && ticket.getStatus() != Ticket.TicketStatus.REFUNDED;
    }

    private String calculatePeakHour(List<Order> orders) {
        return orders.stream()
            .map(this::effectiveOrderTime)
            .filter(Objects::nonNull)
            .collect(Collectors.groupingBy(LocalDateTime::getHour, Collectors.counting()))
            .entrySet()
            .stream()
            .max(Map.Entry.<Integer, Long>comparingByValue()
                .thenComparing(Map.Entry.comparingByKey()))
            .map(entry -> String.format("%02d:00", entry.getKey()))
            .orElse("N/A");
    }

    private LocalDateTime effectiveOrderTime(Order order) {
        return order.getUpdatedAt() != null ? order.getUpdatedAt() : order.getCreatedAt();
    }

    private LocalDateTime showtimeStart(Order order) {
        return showtimeRepository.findById(order.getShowtimeId())
            .map(Showtime::getStartTime)
            .orElse(null);
    }

    private boolean isSameDay(LocalDateTime value, LocalDate date) {
        return value != null && value.toLocalDate().isEqual(date);
    }

    private String formatTime(LocalDateTime value) {
        return value != null ? value.format(TIME_FORMATTER) : "N/A";
    }

    private String formatShowtime(Showtime showtime) {
        return showtime != null && showtime.getStartTime() != null
            ? showtime.getStartTime().format(SHOWTIME_FORMATTER)
            : "N/A";
    }

    private int safeLimit(int limit, int fallback) {
        if (limit <= 0) {
            return fallback;
        }
        return Math.min(limit, 100);
    }
}
