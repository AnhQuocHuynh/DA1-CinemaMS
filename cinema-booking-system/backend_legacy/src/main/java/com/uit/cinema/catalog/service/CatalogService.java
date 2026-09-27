package com.uit.cinema.catalog.service;

import com.uit.cinema.catalog.dto.response.CatalogSearchResponse;
import java.time.LocalDate;

public interface CatalogService {
    CatalogSearchResponse search(String keyword, Long genreId, LocalDate fromDate, LocalDate toDate, int page, int size);
}
