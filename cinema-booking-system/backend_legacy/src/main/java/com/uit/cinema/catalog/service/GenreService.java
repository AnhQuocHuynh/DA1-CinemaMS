package com.uit.cinema.catalog.service;

import com.uit.cinema.catalog.dto.request.GenreRequest;
import com.uit.cinema.catalog.dto.response.GenreResponse;
import java.util.List;

public interface GenreService {
    List<GenreResponse> getAllGenres();
    GenreResponse createGenre(GenreRequest request);
    void deleteGenre(Long id);
}
