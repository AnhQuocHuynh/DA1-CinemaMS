package com.uit.cinema.catalog.service;

import com.uit.cinema.catalog.dto.request.EventRequest;
import com.uit.cinema.catalog.dto.response.EventResponse;

import java.util.List;

public interface EventService {
    List<EventResponse> getUpcomingEvents();
    EventResponse getEventById(Long id);
    EventResponse createEvent(EventRequest request);
    void deleteEvent(Long id);
}
