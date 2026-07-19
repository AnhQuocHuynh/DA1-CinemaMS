package com.uit.cinema.catalog.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CatalogSearchResponse {
    private List<MovieResponse> movies;
    private List<EventResponse> events;
    private int movieTotalPages;
    private int eventTotalPages;
    private long movieTotalElements;
    private long eventTotalElements;
}
