package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.dto.request.EventRequest;
import com.uit.cinema.catalog.dto.response.EventResponse;
import com.uit.cinema.catalog.entity.Event;
import com.uit.cinema.catalog.mapper.EventMapper;
import com.uit.cinema.catalog.repository.EventRepository;
import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.showtime.dto.request.ShowtimeRequest;
import com.uit.cinema.showtime.dto.response.ShowtimeResponse;
import com.uit.cinema.showtime.service.ShowtimeService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EventServiceImplTest {

    @Mock
    private EventRepository eventRepository;

    @Mock
    private EventMapper eventMapper;

    @Mock
    private ShowtimeService showtimeService;

    @InjectMocks
    private EventServiceImpl eventService;

    @Test
    void getUpcomingEvents_ReturnsList() {
        Event event = new Event();
        when(eventRepository.findByEndTimeAfterAndActiveTrueOrderByStartTimeAsc(any(LocalDateTime.class)))
                .thenReturn(List.of(event));
        when(eventMapper.toResponse(event)).thenReturn(new EventResponse());

        List<EventResponse> responses = eventService.getUpcomingEvents();

        assertEquals(1, responses.size());
    }

    @Test
    void getEventById_WhenExists_ReturnsResponse() {
        Event event = new Event();
        when(eventRepository.findById(1L)).thenReturn(Optional.of(event));
        when(eventMapper.toResponse(event)).thenReturn(new EventResponse());

        EventResponse response = eventService.getEventById(1L);

        assertNotNull(response);
    }

    @Test
    void getEventById_WhenNotExists_ThrowsException() {
        when(eventRepository.findById(1L)).thenReturn(Optional.empty());

        CustomException ex = assertThrows(CustomException.class, () -> eventService.getEventById(1L));
        assertEquals("EVENT_NOT_FOUND", ex.getErrorCode());
    }

    @Test
    void createEvent_Success() {
        EventRequest request = new EventRequest();
        
        Event event = new Event();
        event.setId(100L);
        when(eventMapper.toEntity(request)).thenReturn(event);
        when(eventRepository.save(any(Event.class))).thenReturn(event);
        when(eventMapper.toResponse(event)).thenReturn(new EventResponse());

        when(showtimeService.createShowtime(any(ShowtimeRequest.class))).thenReturn(new ShowtimeResponse());

        EventResponse response = eventService.createEvent(request);

        assertNotNull(response);
        verify(eventRepository).save(any(Event.class));
        verify(showtimeService).createShowtime(any(ShowtimeRequest.class));
    }

    @Test
    void deleteEvent_SoftDeletesAndCancelsShowtimes() {
        Event event = new Event();
        event.setActive(true);
        when(eventRepository.findById(1L)).thenReturn(Optional.of(event));

        ShowtimeResponse stResponse = new ShowtimeResponse();
        stResponse.setId(10L);
        when(showtimeService.getShowtimesByEvent(1L)).thenReturn(List.of(stResponse));

        eventService.deleteEvent(1L);

        assertFalse(event.isActive());
        verify(eventRepository).save(event);
        verify(showtimeService).deleteShowtime(10L);
    }
    @Test
    void getAllEvents_ReturnsList() {
        Event event = new Event();
        event.setId(1L);

        when(eventRepository.findAll()).thenReturn(List.of(event));

        EventResponse mapped = new EventResponse();
        when(eventMapper.toResponse(event)).thenReturn(mapped);

        List<EventResponse> result = eventService.getAllEvents();

        assertEquals(1, result.size());
    }
}
