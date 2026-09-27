package com.uit.cinema.showtime.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;
import com.uit.cinema.showtime.service.contract.SeatReleaseRequest;
import com.uit.cinema.showtime.service.contract.SeatView;
import com.uit.cinema.showtime.service.contract.ShowtimeSeatView;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeatReservationServiceImpl implements SeatReservationService {

    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final ShowtimeRepository showtimeRepository;
    private final RedisTemplate<String, Object> redisTemplate;

    @Override
    @Transactional(readOnly = true)
    public SeatHoldValidationResult validateHeldSeats(SeatBookingRequest request) {
        validateRequest(request);
        List<ShowtimeSeat> seats = loadAndValidateSeats(
            request.showtimeId(),
            request.seatIds(),
            ShowtimeSeat.SeatStatus.HELD,
            "Seat is not in HELD status",
            "SEAT_NOT_HELD"
        );
        validateHoldOwners(request, "Seat hold is invalid or expired", "SEAT_HOLD_INVALID");
        return toValidationResult(seats);
    }

    @Override
    @Transactional(readOnly = true)
    public SeatHoldValidationResult validateAvailableSeats(SeatBookingRequest request) {
        validateRequest(request);
        List<ShowtimeSeat> seats = loadAndValidateSeats(
            request.showtimeId(),
            request.seatIds(),
            ShowtimeSeat.SeatStatus.AVAILABLE,
            "Seat is not available",
            "SEAT_NOT_AVAILABLE"
        );
        return toValidationResult(seats);
    }

    @Override
    @Transactional
    public SeatBookingResult confirmHeldSeats(SeatBookingRequest request) {
        validateRequest(request);
        List<ShowtimeSeat> seats = loadAndValidateSeats(
            request.showtimeId(),
            request.seatIds(),
            ShowtimeSeat.SeatStatus.HELD,
            "Seat hold expired",
            "SEAT_HOLD_EXPIRED"
        );
        validateHoldOwners(request, "Seat hold owner mismatch", "SEAT_HOLD_OWNER_MISMATCH");

        for (ShowtimeSeat seat : seats) {
            seat.setStatus(ShowtimeSeat.SeatStatus.BOOKED);
        }
        showtimeSeatRepository.saveAll(seats);
        deleteHoldKeysAfterCommit(request.showtimeId(), request.seatIds());

        log.info("Confirmed {} held seats as BOOKED for showtime {}", seats.size(), request.showtimeId());
        return new SeatBookingResult(request.showtimeId(), request.seatIds(), seats.size(), toSeatViews(seats));
    }

    @Override
    @Transactional
    public SeatBookingResult bookAvailableSeats(SeatBookingRequest request) {
        validateRequest(request);
        List<ShowtimeSeat> seats = loadAndValidateSeats(
            request.showtimeId(),
            request.seatIds(),
            ShowtimeSeat.SeatStatus.AVAILABLE,
            "Seat is not available",
            "SEAT_NOT_AVAILABLE"
        );

        for (ShowtimeSeat seat : seats) {
            seat.setStatus(ShowtimeSeat.SeatStatus.BOOKED);
        }
        showtimeSeatRepository.saveAll(seats);

        log.info("Direct-booked {} available seats for showtime {}", seats.size(), request.showtimeId());
        return new SeatBookingResult(request.showtimeId(), request.seatIds(), seats.size(), toSeatViews(seats));
    }

    @Override
    @Transactional
    public void releaseHeldSeats(SeatBookingRequest request) {
        validateRequest(request);
        List<ShowtimeSeat> seats = loadAndValidateSeats(request.showtimeId(), request.seatIds(), null, null, null);

        for (ShowtimeSeat seat : seats) {
            if (seat.getStatus() == ShowtimeSeat.SeatStatus.HELD) {
                seat.setStatus(ShowtimeSeat.SeatStatus.AVAILABLE);
            }
        }
        showtimeSeatRepository.saveAll(seats);
        deleteHoldKeysAfterCommit(request.showtimeId(), request.seatIds());

        log.info("Released hold for {} seats in showtime {}", seats.size(), request.showtimeId());
    }

    @Override
    @Transactional
    public void releaseBookedSeats(SeatReleaseRequest request) {
        validateReleaseRequest(request);
        List<ShowtimeSeat> seats = loadAndValidateSeats(request.showtimeId(), request.seatIds(), null, null, null);

        for (ShowtimeSeat seat : seats) {
            if (seat.getStatus() == ShowtimeSeat.SeatStatus.BOOKED) {
                seat.setStatus(ShowtimeSeat.SeatStatus.AVAILABLE);
            }
        }
        showtimeSeatRepository.saveAll(seats);

        log.info("Released {} booked seats for showtime {}", seats.size(), request.showtimeId());
    }

    @Override
    @Transactional(readOnly = true)
    public ShowtimeScheduleView getSchedule(Long showtimeId) {
        return findSchedule(showtimeId)
            .orElseThrow(() -> new CustomException("Showtime not found", HttpStatus.NOT_FOUND, "SHOWTIME_NOT_FOUND"));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ShowtimeScheduleView> findSchedule(Long showtimeId) {
        if (showtimeId == null) {
            return Optional.empty();
        }
        return showtimeRepository.findById(showtimeId)
            .map(this::toScheduleView);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ShowtimeSeatView> findSeat(Long seatId) {
        if (seatId == null) {
            return Optional.empty();
        }
        return showtimeSeatRepository.findById(seatId)
            .map(seat -> new ShowtimeSeatView(
                seat.getId(),
                seat.getShowtimeId(),
                seat.getSeatTemplateId(),
                seat.getPrice(),
                seat.getStatus() != null ? seat.getStatus().name() : null
            ));
    }

    private ShowtimeScheduleView toScheduleView(Showtime showtime) {
        return new ShowtimeScheduleView(
            showtime.getId(),
            showtime.getMovieId(),
            showtime.getEventId(),
            showtime.getRoomId(),
            showtime.getStartTime(),
            showtime.getEndTime(),
            showtime.getStatus() != null ? showtime.getStatus().name() : null
        );
    }

    private void validateRequest(SeatBookingRequest request) {
        if (request == null || request.showtimeId() == null || request.seatIds() == null || request.seatIds().isEmpty()) {
            throw new CustomException("Invalid seat request", HttpStatus.BAD_REQUEST, "INVALID_SEAT_REQUEST");
        }
        validateUniqueSeatIds(request.seatIds());
    }

    private void validateReleaseRequest(SeatReleaseRequest request) {
        if (request == null || request.showtimeId() == null || request.seatIds() == null || request.seatIds().isEmpty()) {
            throw new CustomException("Invalid seat request", HttpStatus.BAD_REQUEST, "INVALID_SEAT_REQUEST");
        }
        validateUniqueSeatIds(request.seatIds());
    }

    private void validateUniqueSeatIds(List<Long> seatIds) {
        Set<Long> uniqueSeatIds = new HashSet<>(seatIds);
        if (uniqueSeatIds.size() != seatIds.size()) {
            throw new CustomException("Duplicate seat ids", HttpStatus.BAD_REQUEST, "DUPLICATE_SEAT_IDS");
        }
    }

    private List<ShowtimeSeat> loadAndValidateSeats(
        Long showtimeId,
        List<Long> seatIds,
        ShowtimeSeat.SeatStatus requiredStatus,
        String statusMessage,
        String statusErrorCode
    ) {
        List<ShowtimeSeat> foundSeats = showtimeSeatRepository.findAllById(seatIds);
        Map<Long, ShowtimeSeat> seatById = foundSeats.stream()
            .collect(Collectors.toMap(ShowtimeSeat::getId, Function.identity()));

        List<ShowtimeSeat> orderedSeats = new ArrayList<>(seatIds.size());
        for (Long seatId : seatIds) {
            ShowtimeSeat seat = seatById.get(seatId);
            if (seat == null) {
                throw new CustomException("Seat not found", HttpStatus.NOT_FOUND, "SEAT_NOT_FOUND");
            }
            if (!showtimeId.equals(seat.getShowtimeId())) {
                throw new CustomException("Seat does not belong to showtime", HttpStatus.CONFLICT, "SEAT_SHOWTIME_MISMATCH");
            }
            if (requiredStatus != null && seat.getStatus() != requiredStatus) {
                throw new CustomException(statusMessage, HttpStatus.CONFLICT, statusErrorCode);
            }
            orderedSeats.add(seat);
        }

        return orderedSeats;
    }

    private void validateHoldOwners(SeatBookingRequest request, String message, String errorCode) {
        if (request.userId() == null) {
            throw new CustomException("Seat hold owner is required", HttpStatus.BAD_REQUEST, "SEAT_HOLD_OWNER_REQUIRED");
        }

        for (Long seatId : request.seatIds()) {
            Object holder = redisTemplate.opsForValue().get(SeatHoldPolicy.holdKey(request.showtimeId(), seatId));
            if (holder == null || !String.valueOf(request.userId()).equals(String.valueOf(holder))) {
                throw new CustomException(message, HttpStatus.CONFLICT, errorCode);
            }
        }
    }

    private void deleteHoldKeys(Long showtimeId, List<Long> seatIds) {
        for (Long seatId : seatIds) {
            redisTemplate.delete(SeatHoldPolicy.holdKey(showtimeId, seatId));
        }
    }

    private void deleteHoldKeysAfterCommit(Long showtimeId, List<Long> seatIds) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            deleteHoldKeys(showtimeId, seatIds);
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                deleteHoldKeys(showtimeId, seatIds);
            }
        });
    }

    private SeatHoldValidationResult toValidationResult(List<ShowtimeSeat> seats) {
        List<SeatView> seatViews = toSeatViews(seats);
        BigDecimal totalAmount = seatViews.stream()
            .map(SeatView::price)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new SeatHoldValidationResult(seatViews, totalAmount);
    }

    private List<SeatView> toSeatViews(List<ShowtimeSeat> seats) {
        return seats.stream()
            .map(seat -> new SeatView(seat.getId(), seat.getPrice() != null ? seat.getPrice() : BigDecimal.ZERO))
            .toList();
    }
}
