package com.uit.cinema.facility.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RoomRequest {
    @NotNull(message = "Cinema ID khong duoc de trong")
    private Long cinemaId;

    @NotBlank(message = "Tên phòng không được để trống")
    private String name;

    private String type;
    private Integer totalSeats;
    private Integer rows;
    private Integer columns;
    private boolean active = true;
    private boolean underMaintenance = false;
}
