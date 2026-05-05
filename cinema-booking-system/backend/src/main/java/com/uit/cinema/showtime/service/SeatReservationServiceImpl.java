package com.uit.cinema.showtime.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import com.uit.cinema.showtime.service.contract.SeatBookingRequest;
import com.uit.cinema.showtime.service.contract.SeatBookingResult;
import com.uit.cinema.showtime.service.contract.SeatHoldValidationResult;
import com.uit.cinema.showtime.service.contract.SeatView;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeatReservationServiceImpl implements SeatReservationService {

    private final ShowtimeSeatRepository showtimeSeatRepository;

    @Override
    @Transactional(readOnly = true)
    public SeatHoldValidationResult validateHeldSeats(SeatBookingRequest request) {
        validateRequest(request);

        List<ShowtimeSeat> seats = loadAndValidateSeats(request.showtimeId(), request.seatIds(), true);
        List<SeatView> seatViews = new ArrayList<>(seats.size());
        BigDecimal totalAmount = BigDecimal.ZERO;

        for (ShowtimeSeat seat : seats) {
            seatViews.add(new SeatView(seat.getId(), seat.getPrice()));
            totalAmount = totalAmount.add(seat.getPrice());
        }

        return new SeatHoldValidationResult(seatViews, totalAmount);
    }

    @Override
    @Transactional
    public SeatBookingResult confirmHeldSeats(SeatBookingRequest request) {
        validateRequest(request);

        List<ShowtimeSeat> seats = loadAndValidateSeats(request.showtimeId(), request.seatIds(), true);
        for (ShowtimeSeat seat : seats) {
            seat.setStatus(ShowtimeSeat.SeatStatus.BOOKED);
        }
        showtimeSeatRepository.saveAll(seats);

        log.info("Confirmed {} seats as BOOKED for showtime {}", seats.size(), request.showtimeId());
        return new SeatBookingResult(request.showtimeId(), request.seatIds(), seats.size());
    }

    @Override
    @Transactional
    public void releaseHeldSeats(SeatBookingRequest request) {
        validateRequest(request);

        List<ShowtimeSeat> seats = loadAndValidateSeats(request.showtimeId(), request.seatIds(), false);
        for (ShowtimeSeat seat : seats) {
            if (seat.getStatus() == ShowtimeSeat.SeatStatus.HELD) {
                seat.setStatus(ShowtimeSeat.SeatStatus.AVAILABLE);
            }
        }
        showtimeSeatRepository.saveAll(seats);

        log.info("Released hold for {} seats in showtime {}", seats.size(), request.showtimeId());
    }

    private void validateRequest(SeatBookingRequest request) {
        if (request == null || request.showtimeId() == null || request.seatIds() == null || request.seatIds().isEmpty()) {
            throw new CustomException("Danh sách ghế không hợp lệ", HttpStatus.BAD_REQUEST, "INVALID_SEAT_REQUEST");
        }

        Set<Long> uniqueSeatIds = new HashSet<>(request.seatIds());
        if (uniqueSeatIds.size() != request.seatIds().size()) {
            throw new CustomException("Danh sách ghế bị trùng", HttpStatus.BAD_REQUEST, "DUPLICATE_SEAT_IDS");
        }
    }

    private List<ShowtimeSeat> loadAndValidateSeats(Long showtimeId, List<Long> seatIds, boolean requireHeldStatus) {
        List<ShowtimeSeat> foundSeats = showtimeSeatRepository.findAllById(seatIds);
        Map<Long, ShowtimeSeat> seatById = foundSeats.stream()
            .collect(Collectors.toMap(ShowtimeSeat::getId, Function.identity()));

        List<ShowtimeSeat> orderedSeats = new ArrayList<>(seatIds.size());
        for (Long seatId : seatIds) {
            ShowtimeSeat seat = seatById.get(seatId);
            if (seat == null) {
                throw new CustomException("Ghế không tồn tại", HttpStatus.NOT_FOUND, "SEAT_NOT_FOUND");
            }
            if (!showtimeId.equals(seat.getShowtimeId())) {
                throw new CustomException("Ghế không thuộc suất chiếu", HttpStatus.CONFLICT, "SEAT_SHOWTIME_MISMATCH");
            }
            if (requireHeldStatus && seat.getStatus() != ShowtimeSeat.SeatStatus.HELD) {
                throw new CustomException("Ghế chưa được giữ hoặc đã hết hạn giữ", HttpStatus.CONFLICT, "SEAT_NOT_HELD");
            }
            orderedSeats.add(seat);
        }

        return orderedSeats;
    }
}
