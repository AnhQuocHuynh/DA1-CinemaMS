package com.uit.cinema.facility.mapper;

import com.uit.cinema.facility.dto.request.CinemaRequest;
import com.uit.cinema.facility.dto.response.CinemaResponse;
import com.uit.cinema.facility.entity.Cinema;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper
public interface CinemaMapper {

    CinemaResponse toResponse(Cinema cinema);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "rooms", ignore = true)
    Cinema toEntity(CinemaRequest request);
}
