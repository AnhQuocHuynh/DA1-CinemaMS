package com.uit.cinema.facility.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CinemaRequest {
    @NotBlank(message = "Tên rạp không được để trống")
    private String name;

    @NotBlank(message = "Địa chỉ không được để trống")
    private String address;

    private String city;
    private String phone;
    private boolean active = true;
}
