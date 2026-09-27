package com.uit.cinema.catalog.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GenreRequest {
    @NotBlank(message = "Tên thể loại không được để trống")
    private String name;
}
