package com.uit.cinema.facility.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomResponse {
    private Long id;
    private Long cinemaId;
    private String cinemaName;
    private String name;
    private String type;
    private Integer totalSeats;
    private Integer rows;
    private Integer columns;
    private boolean active;
}
