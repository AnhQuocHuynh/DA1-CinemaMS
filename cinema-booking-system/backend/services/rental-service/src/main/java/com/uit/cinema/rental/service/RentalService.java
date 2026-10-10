package com.uit.cinema.rental.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.rental.client.RentalClients;
import com.uit.cinema.rental.entity.RentalRoomRate;
import com.uit.cinema.rental.entity.RentalStatus;
import com.uit.cinema.rental.entity.RoomRental;
import com.uit.cinema.rental.repository.RentalRoomRateRepository;
import com.uit.cinema.rental.repository.RoomRentalRepository;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class RentalService {

    static final int TURNOVER_MINUTES = 15;
    static final int MIN_MINUTES = 60;
    static final int MAX_MINUTES = 8 * 60;
    private static final List<RentalStatus> BLOCKING = List.of(
        RentalStatus.PENDING_APPROVAL, RentalStatus.AWAITING_PAYMENT, RentalStatus.CONFIRMED);
    private static final List<RentalStatus> EXPIRABLE = List.of(
        RentalStatus.PENDING_APPROVAL, RentalStatus.AWAITING_PAYMENT);

    private final RoomRentalRepository rentals;
    private final RentalRoomRateRepository rates;
    private final RentalClients.FacilityRoomClient rooms;
    private final RentalClients.MovieClient movies;
    private final RentalClients.ShowtimeSlotClient showtimes;

    public RentalService(
        RoomRentalRepository rentals,
        RentalRoomRateRepository rates,
        RentalClients.FacilityRoomClient rooms,
        RentalClients.MovieClient movies,
        RentalClients.ShowtimeSlotClient showtimes
    ) {
        this.rentals = rentals;
        this.rates = rates;
        this.rooms = rooms;
        this.movies = movies;
        this.showtimes = showtimes;
    }

    public RentalModels.Quote quote(RentalModels.Window window) {
        try {
            Prepared prepared = prepare(window);
            return new RentalModels.Quote(
                prepared.room.id(), prepared.room.cinemaId(), prepared.room.name(),
                window.startTime(), window.endTime(), prepared.rate.getPricePerHour(),
                prepared.hours, prepared.total, true, null
            );
        } catch (CustomException ex) {
            if (isSoft(ex.getErrorCode())) {
                return new RentalModels.Quote(window.roomId(), null, null, window.startTime(), window.endTime(),
                    null, 0, null, false, ex.getErrorCode());
            }
            throw ex;
        }
    }

    @Transactional
    public RentalModels.RentalView create(Long userId, RentalModels.Window window) {
        requireUser(userId);
        Prepared prepared = prepare(window);
        RoomRental rental = new RoomRental();
        rental.setUserId(userId);
        rental.setCinemaId(prepared.room.cinemaId());
        rental.setRoomId(prepared.room.id());
        rental.setMovieId(window.movieId());
        rental.setStartTime(window.startTime());
        rental.setEndTime(window.endTime());
        rental.setPricePerHour(prepared.rate.getPricePerHour());
        rental.setTotalAmount(prepared.total);
        rental.setStatus(RentalStatus.PENDING_APPROVAL);
        rental.setExpiresAt(LocalDateTime.now().plusHours(2));
        return view(rentals.save(rental));
    }

    @Transactional
    public RentalModels.RentalView get(Long id, RentalModels.Actor actor) {
        RoomRental rental = loadFresh(id);
        if (!canRead(actor, rental)) {
            throw forbidden();
        }
        return view(rental);
    }

    @Transactional(readOnly = true)
    public List<RentalModels.RentalView> mine(Long userId) {
        requireUser(userId);
        return rentals.findByUserIdOrderByStartTimeDesc(userId).stream().map(this::view).toList();
    }

    @Transactional
    public List<RentalModels.RentalView> search(RentalModels.Actor actor, Long cinemaId, Long roomId, RentalStatus status,
                                                LocalDateTime from, LocalDateTime to) {
        requireReader(actor);
        return filtered(actor, cinemaId, roomId, status, from, to).stream().map(this::view).toList();
    }

    @Transactional
    public RentalModels.Report report(RentalModels.Actor actor, LocalDateTime from, LocalDateTime to) {
        if (actor == null || !(actor.admin() || "MANAGER".equals(actor.realmRole()))) {
            throw forbidden();
        }
        List<RoomRental> rows = filtered(actor, null, null, null, from, to);
        BigDecimal revenue = rows.stream()
            .filter(row -> row.getStatus() == RentalStatus.CONFIRMED)
            .map(RoomRental::getTotalAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new RentalModels.Report(rows.size(), revenue, buckets(rows, true), buckets(rows, false));
    }

    @Transactional
    public RentalModels.RentalView approve(Long id, RentalModels.Actor actor) {
        RoomRental rental = loadFresh(id);
        requireManager(actor, rental.getCinemaId());
        requireStatus(rental, RentalStatus.PENDING_APPROVAL);
        rental.setStatus(RentalStatus.AWAITING_PAYMENT);
        rental.setExpiresAt(LocalDateTime.now().plusMinutes(15));
        return view(rentals.save(rental));
    }

    @Transactional
    public RentalModels.RentalView reject(Long id, String reason, RentalModels.Actor actor) {
        if (reason == null || reason.isBlank()) {
            throw new CustomException("Rejection reason is required", HttpStatus.BAD_REQUEST, "REASON_REQUIRED");
        }
        RoomRental rental = loadFresh(id);
        requireManager(actor, rental.getCinemaId());
        requireStatus(rental, RentalStatus.PENDING_APPROVAL);
        rental.setStatus(RentalStatus.REJECTED);
        rental.setDecisionReason(reason.trim());
        rental.setExpiresAt(null);
        return view(rentals.save(rental));
    }

    @Transactional
    public RentalModels.RentalView pay(Long id, String paymentMethod, RentalModels.Actor actor) {
        RoomRental rental = loadFresh(id);
        if (!(actor.userId().equals(rental.getUserId()) || actor.admin() || actor.managerOf(rental.getCinemaId()))) {
            throw forbidden();
        }
        return confirmPayment(rental, paymentMethod);
    }

    @Transactional
    public RentalModels.RentalView applyPaymentOutcome(Long id, boolean success, String paymentMethod) {
        RoomRental rental = loadFresh(id);
        if (!success) {
            return view(rental);
        }
        return confirmPayment(rental, paymentMethod);
    }

    @Transactional
    public RentalModels.RentalView cancel(Long id, RentalModels.Actor actor) {
        RoomRental rental = loadFresh(id);
        boolean owner = actor.userId().equals(rental.getUserId());
        boolean manager = actor.admin() || actor.managerOf(rental.getCinemaId());
        if (rental.getStatus() == RentalStatus.PENDING_APPROVAL || rental.getStatus() == RentalStatus.AWAITING_PAYMENT) {
            if (!owner && !manager) {
                throw forbidden();
            }
        } else if (rental.getStatus() == RentalStatus.CONFIRMED) {
            if (!manager) {
                throw forbidden();
            }
            if (!rental.getStartTime().isAfter(LocalDateTime.now())) {
                throw new CustomException("Confirmed rental can only be cancelled before it starts", HttpStatus.BAD_REQUEST, "RENTAL_ALREADY_STARTED");
            }
        } else {
            throw new CustomException("Rental cannot be cancelled", HttpStatus.BAD_REQUEST, "INVALID_RENTAL_STATUS");
        }
        rental.setStatus(RentalStatus.CANCELLED);
        rental.setExpiresAt(null);
        return view(rentals.save(rental));
    }

    @Transactional
    public RentalModels.Quote setRate(Long roomId, BigDecimal pricePerHour, RentalModels.Actor actor) {
        if (actor == null || !actor.admin()) {
            throw forbidden();
        }
        if (pricePerHour == null || pricePerHour.signum() <= 0) {
            throw new CustomException("Price per hour must be positive", HttpStatus.BAD_REQUEST, "INVALID_PRICE");
        }
        RentalClients.FacilityRoom room = rooms.getRoom(roomId);
        RentalRoomRate rate = rates.findById(roomId).orElseGet(RentalRoomRate::new);
        rate.setRoomId(room.id());
        rate.setPricePerHour(pricePerHour);
        rate.setActive(true);
        rates.save(rate);
        return new RentalModels.Quote(room.id(), room.cinemaId(), room.name(), null, null, pricePerHour, 0, null, true, null);
    }

    public boolean hasBlockingRental(Long roomId, LocalDateTime start, LocalDateTime end) {
        return rentals.countOverlapping(roomId, start, end, BLOCKING) > 0;
    }

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void expireDueRentals() {
        rentals.expireDue(LocalDateTime.now(), RentalStatus.EXPIRED, EXPIRABLE);
    }

    private RentalModels.RentalView confirmPayment(RoomRental rental, String paymentMethod) {
        requireStatus(rental, RentalStatus.AWAITING_PAYMENT);
        if (paymentMethod == null || paymentMethod.isBlank()) {
            throw new CustomException("Payment method is required", HttpStatus.BAD_REQUEST, "PAYMENT_METHOD_REQUIRED");
        }
        rental.setStatus(RentalStatus.CONFIRMED);
        rental.setPaymentMethod(paymentMethod.trim());
        rental.setExpiresAt(null);
        return view(rentals.save(rental));
    }

    private Prepared prepare(RentalModels.Window window) {
        long minutes = validateWindow(window);
        RentalClients.FacilityRoom room = rooms.getRoom(window.roomId());
        if (!room.active() || room.underMaintenance()) {
            throw new CustomException("Room is not available", HttpStatus.BAD_REQUEST, "ROOM_UNAVAILABLE");
        }
        if (window.movieId() != null) {
            RentalClients.MovieFact movie = movies.getMovie(window.movieId());
            int needed = (movie.durationMinutes() == null ? 0 : movie.durationMinutes()) + TURNOVER_MINUTES;
            if (!movie.active() || minutes < needed) {
                throw new CustomException("Rental window does not fit the movie", HttpStatus.BAD_REQUEST, "MOVIE_DOES_NOT_FIT");
            }
        }
        if (showtimes.hasShowtimeOverlap(window.roomId(), window.startTime(), window.endTime())) {
            throw new CustomException("Room overlaps a showtime", HttpStatus.CONFLICT, "SHOWTIME_OVERLAP");
        }
        if (rentals.countOverlapping(window.roomId(), window.startTime(), window.endTime(), BLOCKING) > 0) {
            throw new CustomException("Room slot is already taken", HttpStatus.CONFLICT, "ROOM_SLOT_TAKEN");
        }
        RentalRoomRate rate = rates.findById(window.roomId())
            .filter(RentalRoomRate::isActive)
            .orElseThrow(() -> new CustomException("Room has no rental rate", HttpStatus.BAD_REQUEST, "ROOM_RATE_MISSING"));
        int hours = (int) ((minutes + 59) / 60);
        BigDecimal total = rate.getPricePerHour().multiply(BigDecimal.valueOf(hours)).setScale(2, RoundingMode.HALF_UP);
        return new Prepared(room, rate, hours, total);
    }

    private long validateWindow(RentalModels.Window window) {
        if (window.roomId() == null || window.startTime() == null || window.endTime() == null) {
            throw new CustomException("Room and time window are required", HttpStatus.BAD_REQUEST, "INVALID_WINDOW");
        }
        if (!window.startTime().isAfter(LocalDateTime.now())) {
            throw new CustomException("Rental must start in the future", HttpStatus.BAD_REQUEST, "INVALID_WINDOW");
        }
        long minutes = Duration.between(window.startTime(), window.endTime()).toMinutes();
        if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
            throw new CustomException("Rental length must be between 1 and 8 hours", HttpStatus.BAD_REQUEST, "INVALID_WINDOW");
        }
        return minutes;
    }

    private RoomRental loadFresh(Long id) {
        RoomRental rental = rentals.findById(id)
            .orElseThrow(() -> new CustomException("Rental not found", HttpStatus.NOT_FOUND, "RENTAL_NOT_FOUND"));
        if (EXPIRABLE.contains(rental.getStatus()) && rental.getExpiresAt() != null && !rental.getExpiresAt().isAfter(LocalDateTime.now())) {
            rental.setStatus(RentalStatus.EXPIRED);
            rental.setExpiresAt(null);
            return rentals.save(rental);
        }
        return rental;
    }

    private List<RoomRental> filtered(RentalModels.Actor actor, Long cinemaId, Long roomId, RentalStatus status,
                                      LocalDateTime from, LocalDateTime to) {
        LocalDateTime rangeStart = from == null ? LocalDateTime.now().minusYears(1) : from;
        LocalDateTime rangeEnd = to == null ? LocalDateTime.now().plusYears(2) : to;
        return rentals.findIntersecting(rangeStart, rangeEnd).stream()
            .filter(row -> cinemaId == null || cinemaId.equals(row.getCinemaId()))
            .filter(row -> roomId == null || roomId.equals(row.getRoomId()))
            .filter(row -> status == null || status == row.getStatus())
            .filter(row -> inScope(actor, row.getCinemaId()))
            .sorted(Comparator.comparing(RoomRental::getStartTime))
            .toList();
    }

    private List<RentalModels.Bucket> buckets(List<RoomRental> rows, boolean byRoom) {
        Map<String, List<RoomRental>> groups = rows.stream().collect(Collectors.groupingBy(row ->
            byRoom ? String.valueOf(row.getRoomId()) : row.getStartTime().toLocalDate().toString()));
        return groups.entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(entry -> new RentalModels.Bucket(
                entry.getKey(),
                entry.getValue().size(),
                entry.getValue().stream()
                    .filter(row -> row.getStatus() == RentalStatus.CONFIRMED)
                    .map(RoomRental::getTotalAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
            ))
            .toList();
    }

    private boolean inScope(RentalModels.Actor actor, Long cinemaId) {
        return actor.admin() || actor.managerOf(cinemaId) || actor.staffOf(cinemaId);
    }

    private boolean canRead(RentalModels.Actor actor, RoomRental rental) {
        return actor.userId().equals(rental.getUserId()) || inScope(actor, rental.getCinemaId());
    }

    private void requireReader(RentalModels.Actor actor) {
        if (actor == null || !(actor.admin() || "MANAGER".equals(actor.realmRole()) || "STAFF".equals(actor.realmRole()))) {
            throw forbidden();
        }
    }

    private void requireManager(RentalModels.Actor actor, Long cinemaId) {
        if (actor == null || !(actor.admin() || actor.managerOf(cinemaId))) {
            throw forbidden();
        }
    }

    private void requireStatus(RoomRental rental, RentalStatus expected) {
        if (rental.getStatus() != expected) {
            throw new CustomException("Rental is not in the required status", HttpStatus.BAD_REQUEST, "INVALID_RENTAL_STATUS");
        }
    }

    private void requireUser(Long userId) {
        if (userId == null || userId <= 0) {
            throw new CustomException("User is required", HttpStatus.BAD_REQUEST, "USER_REQUIRED");
        }
    }

    private CustomException forbidden() {
        return new CustomException("You cannot perform this rental action", HttpStatus.FORBIDDEN, "FORBIDDEN");
    }

    private boolean isSoft(String code) {
        return "ROOM_UNAVAILABLE".equals(code)
            || "MOVIE_DOES_NOT_FIT".equals(code)
            || "SHOWTIME_OVERLAP".equals(code)
            || "ROOM_SLOT_TAKEN".equals(code)
            || "ROOM_RATE_MISSING".equals(code);
    }

    private RentalModels.RentalView view(RoomRental rental) {
        return new RentalModels.RentalView(
            rental.getId(), rental.getUserId(), rental.getCinemaId(), rental.getRoomId(), rental.getMovieId(),
            rental.getStartTime(), rental.getEndTime(), rental.getPricePerHour(), rental.getTotalAmount(),
            rental.getStatus(), rental.getPaymentMethod(), rental.getDecisionReason(), rental.getExpiresAt()
        );
    }

    private record Prepared(RentalClients.FacilityRoom room, RentalRoomRate rate, int hours, BigDecimal total) {
    }
}
