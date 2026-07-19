package com.uit.cinema.showtime.mapper;

import com.uit.cinema.showtime.dto.request.ShowtimeRequest;
import com.uit.cinema.showtime.dto.response.ShowtimeResponse;
import com.uit.cinema.showtime.dto.response.ShowtimeSeatResponse;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper
public interface ShowtimeMapper {

    ShowtimeResponse toResponse(Showtime showtime);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    Showtime toEntity(ShowtimeRequest request);

    ShowtimeSeatResponse toSeatResponse(ShowtimeSeat seat);
}
