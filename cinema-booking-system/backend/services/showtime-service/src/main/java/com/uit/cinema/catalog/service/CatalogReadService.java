package com.uit.cinema.catalog.service;

import com.uit.cinema.catalog.service.contract.CatalogContentView;

import java.util.Optional;

public interface CatalogReadService {
    Optional<CatalogContentView> findMovie(Long movieId);
    Optional<CatalogContentView> findEvent(Long eventId);
    boolean movieExists(Long movieId);
    boolean eventExists(Long eventId);
}
