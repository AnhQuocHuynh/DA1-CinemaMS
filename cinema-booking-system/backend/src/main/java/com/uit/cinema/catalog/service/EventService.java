package com.uit.cinema.catalog.service;

import com.uit.cinema.catalog.entity.Event;
import java.util.List;

public interface EventService {
    List<Event> getUpcomingEvents();
    Event getEventById(Long id);
    Event createEvent(Event event);
    void deleteEvent(Long id);
}
