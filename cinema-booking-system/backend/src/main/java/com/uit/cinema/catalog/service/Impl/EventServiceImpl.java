package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.dto.request.EventRequest;
import com.uit.cinema.catalog.dto.response.EventResponse;
import com.uit.cinema.catalog.entity.Event;
import com.uit.cinema.catalog.mapper.EventMapper;
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
    private final EventMapper eventMapper;

    @Override
    public List<EventResponse> getUpcomingEvents() {
        return eventRepository.findByStartTimeAfterAndActiveTrue(LocalDateTime.now()).stream()
                .map(eventMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    public EventResponse getEventById(Long id) {
        Event event = getEventEntityById(id);
        return eventMapper.toResponse(event);
    }
    
    private Event getEventEntityById(Long id) {
        return eventRepository.findById(id)
            .orElseThrow(() -> new CustomException("Sự kiện không tồn tại", HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND"));
    }

    @Override
    @Transactional
    public EventResponse createEvent(EventRequest request) {
        Event event = eventMapper.toEntity(request);
        Event savedEvent = eventRepository.save(event);
        return eventMapper.toResponse(savedEvent);
    }

    @Override
    @Transactional
    public void deleteEvent(Long id) {
        Event event = getEventEntityById(id);
        event.setActive(false);
        eventRepository.save(event);
    }
}
