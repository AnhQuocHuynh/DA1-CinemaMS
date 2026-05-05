package com.uit.cinema.catalog.controller;

import com.uit.cinema.catalog.dto.request.EventRequest;
import com.uit.cinema.catalog.dto.response.EventResponse;
import com.uit.cinema.catalog.service.EventService;
import com.uit.cinema.core.dto.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EventResponse>>> getUpcomingEvents() {
        List<EventResponse> events = eventService.getUpcomingEvents();
        return ResponseEntity.ok(ApiResponse.success(events, "Lấy danh sách sự kiện sắp tới thành công"));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EventResponse>> getEventById(@PathVariable Long id) {
        EventResponse event = eventService.getEventById(id);
        return ResponseEntity.ok(ApiResponse.success(event, "Lấy thông tin sự kiện thành công"));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<EventResponse>> createEvent(@Valid @RequestBody EventRequest request) {
        EventResponse event = eventService.createEvent(request);
        return ResponseEntity.ok(ApiResponse.success(event, "Tạo sự kiện mới thành công"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteEvent(@PathVariable Long id) {
        eventService.deleteEvent(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Xóa sự kiện thành công"));
    }
}
