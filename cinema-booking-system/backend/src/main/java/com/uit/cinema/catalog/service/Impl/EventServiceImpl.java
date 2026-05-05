package com.uit.cinema.catalog.service.Impl;

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

@Service
@RequiredArgsConstructor
public class EventServiceImpl implements EventService {

    private final EventRepository eventRepository;

    @Override
    public List<Event> getUpcomingEvents() {
        return eventRepository.findByStartTimeAfterAndActiveTrue(LocalDateTime.now());
    }

    @Override
    public Event getEventById(Long id) {
        return eventRepository.findById(id)
            .orElseThrow(() -> new CustomException("Sự kiện không tồn tại", HttpStatus.NOT_FOUND, "EVENT_NOT_FOUND"));
    }

    @Override
    @Transactional
    public Event createEvent(Event event) {
        return eventRepository.save(event);
    }

    @Override
    @Transactional
    public void deleteEvent(Long id) {
        Event event = getEventById(id);
        event.setActive(false);
        eventRepository.save(event);
    }
}
