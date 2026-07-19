package com.uit.cinema.catalog.mapper;

import com.uit.cinema.catalog.dto.request.EventRequest;
import com.uit.cinema.catalog.dto.response.EventResponse;
import com.uit.cinema.catalog.entity.Event;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper
public interface EventMapper {

    EventResponse toResponse(Event event);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    Event toEntity(EventRequest request);
}
