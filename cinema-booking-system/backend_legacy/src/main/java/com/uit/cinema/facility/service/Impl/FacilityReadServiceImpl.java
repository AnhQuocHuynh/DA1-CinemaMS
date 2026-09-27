package com.uit.cinema.facility.service.Impl;

import com.uit.cinema.facility.entity.Cinema;
import com.uit.cinema.facility.entity.SeatTemplate;
import com.uit.cinema.facility.entity.SeatType;
import com.uit.cinema.facility.repository.RoomRepository;
import com.uit.cinema.facility.repository.SeatTemplateRepository;
import com.uit.cinema.facility.service.FacilityReadService;
import com.uit.cinema.facility.service.contract.FacilityRoomView;
import com.uit.cinema.facility.service.contract.FacilitySeatTemplateView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class FacilityReadServiceImpl implements FacilityReadService {

    private final RoomRepository roomRepository;
    private final SeatTemplateRepository seatTemplateRepository;

    @Override
    public Optional<FacilityRoomView> findRoom(Long roomId) {
        if (roomId == null) {
            return Optional.empty();
        }
        return roomRepository.findById(roomId)
            .map(room -> {
                Cinema cinema = room.getCinema();
                return new FacilityRoomView(
                    room.getId(),
                    room.getName(),
                    cinema != null ? cinema.getId() : null,
                    cinema != null ? cinema.getName() : null,
                    room.isUnderMaintenance()
                );
            });
    }

    @Override
    public Optional<FacilitySeatTemplateView> findSeatTemplate(Long seatTemplateId) {
        if (seatTemplateId == null) {
            return Optional.empty();
        }
        return seatTemplateRepository.findById(seatTemplateId)
            .map(this::toSeatTemplateView);
    }

    @Override
    public List<FacilitySeatTemplateView> findActiveSeatTemplatesByRoom(Long roomId) {
        if (roomId == null) {
            return List.of();
        }
        return seatTemplateRepository.findByRoomIdAndActiveTrue(roomId).stream()
            .map(this::toSeatTemplateView)
            .toList();
    }

    private FacilitySeatTemplateView toSeatTemplateView(SeatTemplate template) {
        SeatType seatType = template.getSeatType();
        SeatType.SeatTypeCode code = seatType != null && seatType.getCode() != null
            ? seatType.getCode()
            : SeatType.SeatTypeCode.STANDARD;
        String displayName = seatType != null && seatType.getDisplayName() != null
            ? seatType.getDisplayName()
            : toDisplayName(code);
        Integer columnSpan = template.getColumnSpan() != null
            ? template.getColumnSpan()
            : seatType != null && seatType.getDefaultColumnSpan() != null ? seatType.getDefaultColumnSpan() : 1;
        BigDecimal priceMultiplier = seatType != null && seatType.getPriceMultiplier() != null
            ? seatType.getPriceMultiplier()
            : BigDecimal.ONE;

        return new FacilitySeatTemplateView(
            template.getId(),
            template.getRowLabel(),
            template.getColumnNumber(),
            code.name().toLowerCase(),
            code.name(),
            displayName,
            columnSpan,
            template.isPathway(),
            priceMultiplier
        );
    }

    private String toDisplayName(SeatType.SeatTypeCode code) {
        return switch (code) {
            case VIP -> "VIP";
            case COUPLE -> "Couple";
            case STANDARD -> "Standard";
        };
    }
}
