package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.dto.request.EventRequest;
import com.uit.cinema.catalog.dto.response.EventResponse;
import com.uit.cinema.catalog.entity.Event;
import com.uit.cinema.catalog.repository.EventRepository;
import com.uit.cinema.catalog.service.EventService;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventServiceImpl implements EventService {

    private final EventRepository eventRepository;

    @Override
    public List<EventResponse> getUpcomingEvents() {
        return eventRepository.findByStartTimeAfterAndActiveTrue(LocalDateTime.now()).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public EventResponse getEventById(Long id) {
        Event event = getEventEntityById(id);
        return mapToResponse(event);
    }
    
    private Event getEventEntityById(Long id) {
        return eventRepository.findById(id)
            .orElseThrow(() -> new CustomException("Sự kiện không tồn tại", HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND"));
    }

    @Override
    @Transactional
    public EventResponse createEvent(EventRequest request) {
        Event event = Event.builder()
                .name(request.getName())
                .description(request.getDescription())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .venue(request.getVenue())
                .imageUrl(request.getImageUrl())
                .active(request.isActive())
                .build();
        Event savedEvent = eventRepository.save(event);
        return mapToResponse(savedEvent);
    }

    @Override
    @Transactional
    public void deleteEvent(Long id) {
        Event event = getEventEntityById(id);
        event.setActive(false);
        eventRepository.save(event);
    }
    
    private EventResponse mapToResponse(Event event) {
        return EventResponse.builder()
                .id(event.getId())
                .name(event.getName())
                .description(event.getDescription())
                .startTime(event.getStartTime())
                .endTime(event.getEndTime())
                .venue(event.getVenue())
                .imageUrl(event.getImageUrl())
                .active(event.isActive())
                .createdAt(event.getCreatedAt())
                .updatedAt(event.getUpdatedAt())
                .build();
    }
}
