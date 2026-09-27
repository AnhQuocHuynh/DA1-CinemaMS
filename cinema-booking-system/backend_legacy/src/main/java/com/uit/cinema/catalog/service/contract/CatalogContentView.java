package com.uit.cinema.catalog.service.contract;

import java.time.LocalDate;

/**
 * Lightweight catalog projection for cross-module read models.
 */
public record CatalogContentView(
    Long id,
    String title,
    String type,
    LocalDate releaseDate
) {
    public CatalogContentView(Long id, String title, String type) {
        this(id, title, type, null);
    }
}
