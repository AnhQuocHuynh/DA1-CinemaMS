package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.dto.request.EventRequest;
import com.uit.cinema.catalog.dto.response.EventResponse;
import com.uit.cinema.catalog.entity.Event;
import com.uit.cinema.catalog.mapper.EventMapper;
import com.uit.cinema.catalog.repository.EventRepository;
import com.uit.cinema.catalog.service.EventService;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.dto.request.ShowtimeRequest;
import com.uit.cinema.showtime.service.ShowtimeService;
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
    private final ShowtimeService showtimeService;

    @Override
    public List<EventResponse> getUpcomingEvents() {
        return eventRepository.findByEndTimeAfterAndActiveTrueOrderByStartTimeAsc(LocalDateTime.now()).stream()
                .map(eventMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    public List<EventResponse> getAllEvents() {
        return eventRepository.findAll().stream()
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

        ShowtimeRequest showtimeRequest = new ShowtimeRequest();
        showtimeRequest.setEventId(savedEvent.getId());
        showtimeRequest.setRoomId(request.getRoomId());
        showtimeRequest.setStartTime(request.getStartTime());
        showtimeRequest.setEndTime(request.getEndTime());
        showtimeRequest.setBasePrice(request.getBasePrice());

        showtimeService.createShowtime(showtimeRequest);

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
