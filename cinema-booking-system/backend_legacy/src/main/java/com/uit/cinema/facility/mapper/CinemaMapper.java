package com.uit.cinema.facility.mapper;

import com.uit.cinema.facility.dto.request.CinemaRequest;
import com.uit.cinema.facility.dto.response.CinemaResponse;
import com.uit.cinema.facility.entity.Cinema;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

@Mapper
public interface CinemaMapper {

    CinemaResponse toResponse(Cinema cinema);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "rooms", ignore = true)
    Cinema toEntity(CinemaRequest request);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "rooms", ignore = true)
    void updateEntity(@MappingTarget Cinema cinema, CinemaRequest request);
}
