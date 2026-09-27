package com.uit.cinema.facility.service;

import com.uit.cinema.facility.service.contract.FacilityRoomView;
import com.uit.cinema.facility.service.contract.FacilitySeatTemplateView;

import java.util.List;
import java.util.Optional;

public interface FacilityReadService {
    Optional<FacilityRoomView> findRoom(Long roomId);
    Optional<FacilitySeatTemplateView> findSeatTemplate(Long seatTemplateId);
    List<FacilitySeatTemplateView> findActiveSeatTemplatesByRoom(Long roomId);
}
