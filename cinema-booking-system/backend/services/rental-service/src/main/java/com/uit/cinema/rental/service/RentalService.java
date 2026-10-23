package com.uit.cinema.rental.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.rental.client.RentalClients;
import com.uit.cinema.rental.entity.RefundStatus;
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
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class RentalService {

    static final int MIN_MINUTES = 60;
    static final int MAX_MINUTES = 8 * 60;
    private static final int MAX_AVAILABILITY_DAYS = 62;
    private static final List<RentalStatus> BLOCKING = List.of(
        RentalStatus.PENDING_APPROVAL, RentalStatus.AWAITING_PAYMENT, RentalStatus.CONFIRMED);
    private static final List<RentalStatus> EXPIRABLE = List.of(
        RentalStatus.PENDING_APPROVAL, RentalStatus.AWAITING_PAYMENT);

    private final RoomRentalRepository rentals;
    private final RentalRoomRateRepository rates;
    private final RentalClients.FacilityRoomClient rooms;
    private final RentalClients.MovieClient movies;
    private final RentalClients.ShowtimeSlotClient showtimes;
    private final Clock clock;
    private final RentalRules rules;
    private final RentalNotifier notifier;

    public RentalService(
        RoomRentalRepository rentals,
        RentalRoomRateRepository rates,
        RentalClients.FacilityRoomClient rooms,
        RentalClients.MovieClient movies,
        RentalClients.ShowtimeSlotClient showtimes,
        Clock clock,
        RentalRules rules,
        RentalNotifier notifier
    ) {
        this.rentals = rentals;
        this.rates = rates;
        this.rooms = rooms;
        this.movies = movies;
        this.showtimes = showtimes;
        this.clock = clock;
        this.rules = rules;
        this.notifier = notifier;
    }

    public RentalModels.Quote quote(RentalModels.Window window) {
        try {
            Prepared prepared = prepare(window);
            return new RentalModels.Quote(
                prepared.room.id(), prepared.room.cinemaId(), prepared.room.name(),
                window.startTime(), window.endTime(), prepared.pricePerHour,
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
        rental.setPricePerHour(prepared.pricePerHour);
        rental.setTotalAmount(prepared.total);
        rental.setStatus(RentalStatus.PENDING_APPROVAL);
        rental.setRefundStatus(RefundStatus.NONE);
        rental.setExpiresAt(now().plusHours(2));
        RoomRental saved = rentals.save(rental);
        notify(saved, "Đã gửi yêu cầu thuê", "Đơn thuê " + saved.getId() + " đang chờ duyệt.");
        return view(saved);
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

    public RentalModels.Availability availability(Long roomId, LocalDateTime from, LocalDateTime to) {
        if (roomId == null || from == null || to == null || !to.isAfter(from)) {
            throw new CustomException("Availability range is required", HttpStatus.BAD_REQUEST, "INVALID_WINDOW");
        }
        if (Duration.between(from, to).toDays() > MAX_AVAILABILITY_DAYS) {
            throw new CustomException("Availability range must be 62 days or less", HttpStatus.BAD_REQUEST, "INVALID_WINDOW");
        }
        RentalClients.FacilityRoom room = rooms.getRoom(roomId);
        LocalDateTime rangeStart = blockedStart(from);
        LocalDateTime rangeEnd = blockedEnd(to);
        List<RentalModels.BusySlot> busy = new ArrayList<>();
        for (RoomRental rental : rentals.findBlockingForRoom(roomId, rangeStart, rangeEnd, BLOCKING)) {
            busy.add(new RentalModels.BusySlot(
                "RENTAL",
                blockedStart(rental.getStartTime()),
                blockedEnd(rental.getEndTime()),
                rental.getStatus().name()
            ));
        }
        for (RentalClients.ShowtimeSlot slot : showtimes.activeShowtimes(roomId, rangeStart, rangeEnd)) {
            if (slot.startTime() == null || slot.endTime() == null) {
                continue;
            }
            busy.add(new RentalModels.BusySlot(
                "SHOWTIME",
                blockedStart(slot.startTime()),
                blockedEnd(slot.endTime()),
                slot.status()
            ));
        }
        return new RentalModels.Availability(room.id(), from, to, baseHourlyPrice(roomId), busy);
    }

    @Transactional
    public RentalModels.RentalView approve(Long id, RentalModels.Actor actor) {
        RoomRental rental = loadFresh(id);
        requireManager(actor, rental.getCinemaId());
        requireStatus(rental, RentalStatus.PENDING_APPROVAL);
        requireShowtimeClear(rental);
        rental.setStatus(RentalStatus.AWAITING_PAYMENT);
        rental.setExpiresAt(now().plusMinutes(15));
        RoomRental saved = rentals.save(rental);
        notify(saved, "Đã duyệt đơn thuê", "Đơn thuê " + saved.getId() + " đang chờ thanh toán.");
        return view(saved);
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
        RoomRental saved = rentals.save(rental);
        notify(saved, "Đã từ chối đơn thuê", "Đơn thuê " + saved.getId() + " bị từ chối: " + saved.getDecisionReason());
        return view(saved);
    }

    @Transactional
    public RentalModels.RentalView pay(Long id, String paymentMethod, RentalModels.Actor actor) {
        RoomRental rental = loadFresh(id);
        if (actor == null || !(actor.userId().equals(rental.getUserId()) || actor.admin() || actor.managerOf(rental.getCinemaId()))) {
            throw forbidden();
        }
        requireStatus(rental, RentalStatus.AWAITING_PAYMENT);
        String method = normalizeMethod(paymentMethod);
        if ("CASH".equals(method)) {
            if (!(actor.admin() || actor.managerOf(rental.getCinemaId()))) {
                throw new CustomException(
                    "Cash payment can only be confirmed at the cinema counter",
                    HttpStatus.FORBIDDEN,
                    "CASH_COUNTER_ONLY"
                );
            }
            return confirmPayment(rental, method);
        }
        rental.setPaymentMethod(method);
        RoomRental saved = rentals.save(rental);
        notify(saved, "Đã ghi nhận thanh toán", "Đơn thuê " + saved.getId() + " đang chờ kết quả " + method + ".");
        return view(saved);
    }

    @Transactional
    public RentalModels.RentalView applyPaymentOutcome(Long id, boolean success, String paymentMethod) {
        RoomRental rental = loadFresh(id);
        if (!success) {
            return view(rental);
        }
        return confirmPayment(rental, normalizeMethod(paymentMethod));
    }

    @Transactional
    public RentalModels.RentalView cancel(Long id, RentalModels.Actor actor) {
        RoomRental rental = loadFresh(id);
        if (actor == null) {
            throw forbidden();
        }
        boolean owner = actor.userId().equals(rental.getUserId());
        boolean manager = actor.admin() || actor.managerOf(rental.getCinemaId());
        if (rental.getStatus() == RentalStatus.PENDING_APPROVAL || rental.getStatus() == RentalStatus.AWAITING_PAYMENT) {
            if (!owner && !manager) {
                throw forbidden();
            }
        } else if (rental.getStatus() == RentalStatus.CONFIRMED) {
            if (!rental.getStartTime().isAfter(now())) {
                throw new CustomException(
                    "Confirmed rental can only be cancelled before it starts",
                    HttpStatus.BAD_REQUEST,
                    "RENTAL_ALREADY_STARTED"
                );
            }
            if (manager) {
                markRefundPending(rental);
            } else if (owner) {
                if (rental.getStartTime().isBefore(now().plusHours(rules.customerCancelHours()))) {
                    throw new CustomException(
                        "Customer can cancel a confirmed rental only until 24 hours before it starts",
                        HttpStatus.BAD_REQUEST,
                        "CUSTOMER_CANCEL_WINDOW_CLOSED"
                    );
                }
                markRefundPending(rental);
            } else {
                throw forbidden();
            }
        } else {
            throw new CustomException("Rental cannot be cancelled", HttpStatus.BAD_REQUEST, "INVALID_RENTAL_STATUS");
        }
        rental.setStatus(RentalStatus.CANCELLED);
        rental.setExpiresAt(null);
        RoomRental saved = rentals.save(rental);
        notify(saved, "Đã hủy đơn thuê", "Đơn thuê " + saved.getId() + " đã được hủy.");
        return view(saved);
    }

    @Transactional
    public RentalModels.RentalView completeRefund(Long id, RentalModels.Actor actor) {
        RoomRental rental = loadFresh(id);
        requireManager(actor, rental.getCinemaId());
        if (rental.getStatus() != RentalStatus.CANCELLED || rental.getRefundStatus() != RefundStatus.PENDING) {
            throw new CustomException("Refund is not pending", HttpStatus.BAD_REQUEST, "REFUND_NOT_PENDING");
        }
        rental.setRefundStatus(RefundStatus.COMPLETED);
        RoomRental saved = rentals.save(rental);
        notify(saved, "Đã hoàn tiền", "Hoàn tiền cho đơn thuê " + saved.getId() + " đã được ghi nhận.");
        return view(saved);
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
        if (roomId == null || start == null || end == null || !end.isAfter(start)) {
            return false;
        }
        return rentals.countOverlapping(roomId, blockedStart(start), blockedEnd(end), BLOCKING) > 0;
    }

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void expireDueRentals() {
        rentals.expireDue(now(), RentalStatus.EXPIRED, EXPIRABLE);
    }

    private RentalModels.RentalView confirmPayment(RoomRental rental, String paymentMethod) {
        requireStatus(rental, RentalStatus.AWAITING_PAYMENT);
        requireShowtimeClear(rental);
        rental.setStatus(RentalStatus.CONFIRMED);
        rental.setPaymentMethod(paymentMethod);
        rental.setExpiresAt(null);
        RoomRental saved = rentals.save(rental);
        notify(saved, "Đã xác nhận thanh toán", "Đơn thuê " + saved.getId() + " đã được xác nhận.");
        return view(saved);
    }

    private Prepared prepare(RentalModels.Window window) {
        long minutes = validateWindow(window);
        RentalClients.FacilityRoom room = rooms.getRoom(window.roomId());
        if (!room.active() || room.underMaintenance()) {
            throw new CustomException("Room is not available", HttpStatus.BAD_REQUEST, "ROOM_UNAVAILABLE");
        }
        if (window.movieId() != null) {
            RentalClients.MovieFact movie = movies.getMovie(window.movieId());
            int needed = (movie.durationMinutes() == null ? 0 : movie.durationMinutes()) + rules.turnoverMinutes();
            if (!movie.active() || minutes < needed) {
                throw new CustomException("Rental window does not fit the movie", HttpStatus.BAD_REQUEST, "MOVIE_DOES_NOT_FIT");
            }
        }
        LocalDateTime blockedStart = blockedStart(window.startTime());
        LocalDateTime blockedEnd = blockedEnd(window.endTime());
        if (showtimes.hasShowtimeOverlap(window.roomId(), blockedStart, blockedEnd)) {
            throw new CustomException("Room overlaps a showtime", HttpStatus.CONFLICT, "SHOWTIME_OVERLAP");
        }
        if (rentals.countOverlapping(window.roomId(), blockedStart, blockedEnd, BLOCKING) > 0) {
            throw new CustomException("Room slot is already taken", HttpStatus.CONFLICT, "ROOM_SLOT_TAKEN");
        }
        BigDecimal hourly = pricedHourly(baseHourlyPrice(window.roomId()), window.startTime(), window.endTime());
        int hours = (int) ((minutes + 59) / 60);
        BigDecimal total = hourly.multiply(BigDecimal.valueOf(hours)).setScale(2, RoundingMode.HALF_UP);
        return new Prepared(room, hourly, hours, total);
    }

    private BigDecimal baseHourlyPrice(Long roomId) {
        BigDecimal configured = rates.findById(roomId)
            .filter(RentalRoomRate::isActive)
            .map(RentalRoomRate::getPricePerHour)
            .orElse(null);
        if (configured != null && configured.signum() > 0) {
            return configured;
        }
        if (rules.defaultPricePerHour() != null && rules.defaultPricePerHour().signum() > 0) {
            return rules.defaultPricePerHour();
        }
        throw new CustomException("Room has no rental rate", HttpStatus.BAD_REQUEST, "ROOM_RATE_MISSING");
    }

    private BigDecimal pricedHourly(BigDecimal base, LocalDateTime start, LocalDateTime end) {
        BigDecimal hourly = base;
        DayOfWeek day = start.getDayOfWeek();
        if (day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY) {
            hourly = hourly.multiply(rules.weekendMultiplier());
        }
        if (overlapsPeak(start, end)) {
            hourly = hourly.multiply(rules.peakMultiplier());
        }
        return hourly.setScale(2, RoundingMode.HALF_UP);
    }

    private boolean overlapsPeak(LocalDateTime start, LocalDateTime end) {
        LocalDate last = end.toLocalDate();
        for (LocalDate day = start.toLocalDate(); !day.isAfter(last); day = day.plusDays(1)) {
            LocalDateTime peakStart = day.atTime(rules.peakStartHour(), 0);
            LocalDateTime peakEnd = day.atTime(rules.peakEndHour(), 0);
            if (start.isBefore(peakEnd) && end.isAfter(peakStart)) {
                return true;
            }
        }
        return false;
    }

    private void requireShowtimeClear(RoomRental rental) {
        if (showtimes.hasShowtimeOverlap(rental.getRoomId(), blockedStart(rental.getStartTime()), blockedEnd(rental.getEndTime()))) {
            throw new CustomException("Room overlaps a showtime", HttpStatus.CONFLICT, "SHOWTIME_OVERLAP");
        }
    }

    private void markRefundPending(RoomRental rental) {
        rental.setRefundAmount(rental.getTotalAmount());
        rental.setRefundStatus(RefundStatus.PENDING);
    }

    private LocalDateTime blockedStart(LocalDateTime start) {
        return start.minusMinutes(rules.turnoverMinutes());
    }

    private LocalDateTime blockedEnd(LocalDateTime end) {
        return end.plusMinutes(rules.turnoverMinutes());
    }

    private String normalizeMethod(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.isBlank()) {
            throw new CustomException("Payment method is required", HttpStatus.BAD_REQUEST, "PAYMENT_METHOD_REQUIRED");
        }
        return paymentMethod.trim().toUpperCase(Locale.ROOT);
    }

    private void notify(RoomRental rental, String title, String body) {
        try {
            notifier.statusChanged(rental.getUserId(), rental.getId(), title, body);
        } catch (RuntimeException ex) {
            // Notification delivery must not roll back the rental change.
        }
    }

    private long validateWindow(RentalModels.Window window) {
        if (window.roomId() == null || window.startTime() == null || window.endTime() == null) {
            throw new CustomException("Room and time window are required", HttpStatus.BAD_REQUEST, "INVALID_WINDOW");
        }
        if (!window.startTime().isAfter(now())) {
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
        if (EXPIRABLE.contains(rental.getStatus()) && rental.getExpiresAt() != null && !rental.getExpiresAt().isAfter(now())) {
            rental.setStatus(RentalStatus.EXPIRED);
            rental.setExpiresAt(null);
            return rentals.save(rental);
        }
        return rental;
    }

    private List<RoomRental> filtered(RentalModels.Actor actor, Long cinemaId, Long roomId, RentalStatus status,
                                      LocalDateTime from, LocalDateTime to) {
        LocalDateTime rangeStart = from == null ? now().minusYears(1) : from;
        LocalDateTime rangeEnd = to == null ? now().plusYears(2) : to;
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
        RefundStatus refundStatus = rental.getRefundStatus() == null ? RefundStatus.NONE : rental.getRefundStatus();
        return new RentalModels.RentalView(
            rental.getId(), rental.getUserId(), rental.getCinemaId(), rental.getRoomId(), rental.getMovieId(),
            rental.getStartTime(), rental.getEndTime(), rental.getPricePerHour(), rental.getTotalAmount(),
            rental.getStatus(), rental.getPaymentMethod(), rental.getDecisionReason(), rental.getExpiresAt(),
            rental.getRefundAmount(), refundStatus
        );
    }

    private LocalDateTime now() {
        return LocalDateTime.now(clock);
    }

    private record Prepared(RentalClients.FacilityRoom room, BigDecimal pricePerHour, int hours, BigDecimal total) {
    }
}
