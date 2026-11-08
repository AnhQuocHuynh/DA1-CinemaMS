package com.uit.cinema.catalog.service;

import com.uit.cinema.catalog.dto.response.CatalogSearchResponse;
import java.time.LocalDate;

public interface CatalogService {
    CatalogSearchResponse search(String keyword, Long genreId, LocalDate fromDate, LocalDate toDate, String status, int page, int size);
}
