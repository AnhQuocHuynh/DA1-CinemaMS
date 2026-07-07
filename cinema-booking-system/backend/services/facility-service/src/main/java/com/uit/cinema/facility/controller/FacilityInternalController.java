package com.uit.cinema.facility.controller;

import com.uit.cinema.core.dto.response.ApiResponse;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.facility.service.FacilityReadService;
import com.uit.cinema.facility.service.contract.FacilityRoomView;
import com.uit.cinema.facility.service.contract.FacilitySeatTemplateView;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/internal/facility")
@RequiredArgsConstructor
public class FacilityInternalController {

    private final FacilityReadService facilityReadService;

    @GetMapping("/rooms/{roomId}")
    public ResponseEntity<ApiResponse<FacilityRoomView>> getRoom(@PathVariable Long roomId) {
        FacilityRoomView room = facilityReadService.findRoom(roomId)
            .orElseThrow(() -> new CustomException("Room not found", HttpStatus.NOT_FOUND, "ROOM_NOT_FOUND"));
        return ResponseEntity.ok(ApiResponse.success(room));
    }

    @GetMapping("/seat-templates/{seatTemplateId}")
    public ResponseEntity<ApiResponse<FacilitySeatTemplateView>> getSeatTemplate(@PathVariable Long seatTemplateId) {
        FacilitySeatTemplateView seatTemplate = facilityReadService.findSeatTemplate(seatTemplateId)
            .orElseThrow(() -> new CustomException("Seat template not found", HttpStatus.NOT_FOUND, "SEAT_TEMPLATE_NOT_FOUND"));
        return ResponseEntity.ok(ApiResponse.success(seatTemplate));
    }

    @GetMapping("/rooms/{roomId}/seat-templates")
    public ResponseEntity<ApiResponse<List<FacilitySeatTemplateView>>> getActiveSeatTemplates(@PathVariable Long roomId) {
        return ResponseEntity.ok(ApiResponse.success(facilityReadService.findActiveSeatTemplatesByRoom(roomId)));
    }
}
