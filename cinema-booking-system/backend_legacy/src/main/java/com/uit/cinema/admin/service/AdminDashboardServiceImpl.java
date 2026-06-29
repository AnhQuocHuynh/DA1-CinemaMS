package com.uit.cinema.admin.service;

import com.uit.cinema.admin.dto.response.AdminDashboardOverviewResponse;
import com.uit.cinema.admin.dto.response.AdminLiveSaleResponse;
import com.uit.cinema.admin.dto.response.AdminPopularMovieResponse;
import com.uit.cinema.admin.dto.response.AdminRevenuePointResponse;
import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.catalog.entity.Event;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.EventRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.facility.entity.Room;
import com.uit.cinema.facility.repository.RoomRepository;
import com.uit.cinema.iam.repository.UserRepository;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AdminDashboardServiceImpl implements AdminDashboardService {

    private static final DateTimeFormatter DAY_LABEL_FORMATTER = DateTimeFormatter.ofPattern("MMM dd");

    private final OrderRepository orderRepository;
    private final ShowtimeRepository showtimeRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final MovieRepository movieRepository;
    private final EventRepository eventRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;

    @Override
    public AdminDashboardOverviewResponse getOverview(LocalDate from, LocalDate to) {
        DateRange range = resolveRange(from, to);
        DateRange previousRange = previousRange(range);
        List<Order> paidOrders = paidOrdersInRange(range);
        List<Order> previousPaidOrders = paidOrdersInRange(previousRange);
        BigDecimal totalRevenue = sumRevenue(paidOrders);
        BigDecimal previousRevenue = sumRevenue(previousPaidOrders);
        OccupancySnapshot occupancy = occupancy(range);

        return AdminDashboardOverviewResponse.builder()
            .totalRevenue(totalRevenue)
            .revenueChange(formatRevenueChange(totalRevenue, previousRevenue))
            .occupancyRate(occupancy.occupancyRate())
            .seatsSold(occupancy.seatsSold())
            .seatsAvailable(occupancy.seatsAvailable())
            .totalBookings((long) paidOrders.size())
            .activeUsers(userRepository.findAll().stream().filter(user -> user.isActive()).count())
            .totalMovies(movieRepository.count())
            .build();
    }

    @Override
    public List<AdminRevenuePointResponse> getRevenueSeries(LocalDate from, LocalDate to, String bucket) {
        DateRange range = resolveRange(from, to);
        Map<LocalDate, RevenueAccumulator> byDay = new LinkedHashMap<>();
        LocalDate cursor = range.from().toLocalDate();
        LocalDate endDate = range.to().minusNanos(1).toLocalDate();
        while (!cursor.isAfter(endDate)) {
            byDay.put(cursor, new RevenueAccumulator());
            cursor = cursor.plusDays(1);
        }

        for (Order order : paidOrdersInRange(range)) {
            LocalDate day = effectiveOrderTime(order).toLocalDate();
            RevenueAccumulator accumulator = byDay.computeIfAbsent(day, ignored -> new RevenueAccumulator());
            accumulator.revenue = accumulator.revenue.add(safeAmount(order.getFinalAmount()));
            accumulator.orders++;
            accumulator.tickets += parseSeatIds(order.getSeatIdsSnapshot()).size();
        }

        return byDay.entrySet().stream()
            .map(entry -> AdminRevenuePointResponse.builder()
                .label(entry.getKey().format(DAY_LABEL_FORMATTER))
                .revenue(entry.getValue().revenue)
                .orders(entry.getValue().orders)
                .tickets(entry.getValue().tickets)
                .build())
            .toList();
    }

    @Override
    public List<AdminLiveSaleResponse> getLiveSales(int limit) {
        int safeLimit = normalizeLimit(limit, 5, 20);
        return orderRepository.findAll().stream()
            .filter(order -> order.getStatus() == Order.OrderStatus.PAID)
            .sorted(Comparator.comparing(this::effectiveOrderTime, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
            .limit(safeLimit)
            .map(this::toLiveSale)
            .toList();
    }

    @Override
    public List<AdminPopularMovieResponse> getPopularMovies(LocalDate from, LocalDate to, int limit) {
        DateRange range = resolveRange(from, to);
        int safeLimit = normalizeLimit(limit, 5, 20);
        Map<Long, PopularAccumulator> byMovie = new HashMap<>();

        for (Order order : paidOrdersInRange(range)) {
            Optional<Showtime> showtime = showtimeRepository.findById(order.getShowtimeId());
            if (showtime.isEmpty()) {
                continue;
            }
            Long movieId = showtime.get().getMovieId();
            if (movieId == null) {
                continue;
            }
            PopularAccumulator accumulator = byMovie.computeIfAbsent(movieId, ignored -> new PopularAccumulator());
            accumulator.ticketsSold += parseSeatIds(order.getSeatIdsSnapshot()).size();
            accumulator.revenue = accumulator.revenue.add(safeAmount(order.getFinalAmount()));
        }

        long topTickets = byMovie.values().stream()
            .mapToLong(accumulator -> accumulator.ticketsSold)
            .max()
            .orElse(0L);

        return byMovie.entrySet().stream()
            .sorted((left, right) -> Long.compare(right.getValue().ticketsSold, left.getValue().ticketsSold))
            .limit(safeLimit)
            .map(entry -> {
                Movie movie = movieRepository.findById(entry.getKey()).orElse(null);
                PopularAccumulator accumulator = entry.getValue();
                int score = topTickets == 0 ? 0 : (int) Math.round(accumulator.ticketsSold * 100.0 / topTickets);
                return AdminPopularMovieResponse.builder()
                    .id(String.valueOf(entry.getKey()))
                    .title(movie != null ? movie.getTitle() : "Movie #" + entry.getKey())
                    .score(score)
                    .ticketsSold(accumulator.ticketsSold)
                    .revenue(accumulator.revenue)
                    .build();
            })
            .toList();
    }

    private AdminLiveSaleResponse toLiveSale(Order order) {
        Optional<Showtime> showtime = showtimeRepository.findById(order.getShowtimeId());
        Movie movie = showtime.map(Showtime::getMovieId)
            .filter(java.util.Objects::nonNull)
            .flatMap(movieRepository::findById)
            .orElse(null);
        Event event = showtime.map(Showtime::getEventId)
            .filter(java.util.Objects::nonNull)
            .flatMap(eventRepository::findById)
            .orElse(null);
        Room room = showtime.flatMap(value -> roomRepository.findById(value.getRoomId())).orElse(null);
        String title = movie != null ? movie.getTitle() : event != null ? event.getName() : "Unknown showtime";
        return AdminLiveSaleResponse.builder()
            .id("order-" + order.getId())
            .movieTitle(title)
            .screen(room != null ? room.getName() : "Unknown room")
            .tickets(parseSeatIds(order.getSeatIdsSnapshot()).size())
            .amount(safeAmount(order.getFinalAmount()))
            .posterUrl(movie != null ? movie.getPosterUrl() : null)
            .build();
    }

    private OccupancySnapshot occupancy(DateRange range) {
        List<Long> showtimeIds = showtimeRepository.findAll().stream()
            .filter(showtime -> showtime.getStatus() != Showtime.Status.CANCELLED)
            .filter(showtime -> !showtime.getStartTime().isBefore(range.from()) && showtime.getStartTime().isBefore(range.to()))
            .map(Showtime::getId)
            .toList();
        if (showtimeIds.isEmpty()) {
            return new OccupancySnapshot(0L, 0L, 0);
        }

        long sold = 0;
        long available = 0;
        long total = 0;
        for (Long showtimeId : showtimeIds) {
            List<ShowtimeSeat> seats = showtimeSeatRepository.findByShowtimeId(showtimeId);
            total += seats.size();
            sold += seats.stream().filter(seat -> seat.getStatus() == ShowtimeSeat.SeatStatus.BOOKED).count();
            available += seats.stream().filter(seat -> seat.getStatus() == ShowtimeSeat.SeatStatus.AVAILABLE).count();
        }
        int rate = total == 0 ? 0 : (int) Math.round(sold * 100.0 / total);
        return new OccupancySnapshot(sold, available, rate);
    }

    private List<Order> paidOrdersInRange(DateRange range) {
        return orderRepository.findAll().stream()
            .filter(order -> order.getStatus() == Order.OrderStatus.PAID)
            .filter(order -> {
                LocalDateTime time = effectiveOrderTime(order);
                return time != null && !time.isBefore(range.from()) && time.isBefore(range.to());
            })
            .toList();
    }

    private BigDecimal sumRevenue(List<Order> orders) {
        return orders.stream()
            .map(order -> safeAmount(order.getFinalAmount()))
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal safeAmount(BigDecimal amount) {
        return amount != null ? amount : BigDecimal.ZERO;
    }

    private String formatRevenueChange(BigDecimal current, BigDecimal previous) {
        if (previous.compareTo(BigDecimal.ZERO) == 0) {
            return current.compareTo(BigDecimal.ZERO) > 0 ? "+100% vs previous period" : "0% vs previous period";
        }
        BigDecimal change = current.subtract(previous)
            .multiply(BigDecimal.valueOf(100))
            .divide(previous, 1, RoundingMode.HALF_UP);
        String prefix = change.compareTo(BigDecimal.ZERO) >= 0 ? "+" : "";
        return prefix + change + "% vs previous period";
    }

    private DateRange resolveRange(LocalDate from, LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.minusDays(29);
        if (start.isAfter(end)) {
            LocalDate temp = start;
            start = end;
            end = temp;
        }
        return new DateRange(start.atStartOfDay(), end.plusDays(1).atStartOfDay());
    }

    private DateRange previousRange(DateRange range) {
        Duration duration = Duration.between(range.from(), range.to());
        LocalDateTime previousTo = range.from();
        LocalDateTime previousFrom = previousTo.minus(duration);
        return new DateRange(previousFrom, previousTo);
    }

    private LocalDateTime effectiveOrderTime(Order order) {
        return order.getUpdatedAt() != null ? order.getUpdatedAt() : order.getCreatedAt();
    }

    private List<Long> parseSeatIds(String snapshot) {
        if (snapshot == null || snapshot.isBlank()) {
            return List.of();
        }
        List<Long> seatIds = new ArrayList<>();
        for (String value : snapshot.split(",")) {
            String trimmed = value.trim();
            if (!trimmed.isEmpty()) {
                seatIds.add(Long.valueOf(trimmed));
            }
        }
        return seatIds;
    }

    private int normalizeLimit(int requested, int defaultValue, int max) {
        if (requested <= 0) {
            return defaultValue;
        }
        return Math.min(requested, max);
    }

    private record DateRange(LocalDateTime from, LocalDateTime to) {
    }

    private record OccupancySnapshot(long seatsSold, long seatsAvailable, int occupancyRate) {
    }

    private static class RevenueAccumulator {
        private BigDecimal revenue = BigDecimal.ZERO;
        private long orders = 0;
        private long tickets = 0;
    }

    private static class PopularAccumulator {
        private long ticketsSold = 0;
        private BigDecimal revenue = BigDecimal.ZERO;
    }
}
