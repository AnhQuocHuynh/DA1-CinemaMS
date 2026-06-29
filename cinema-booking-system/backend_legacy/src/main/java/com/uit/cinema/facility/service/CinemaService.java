package com.uit.cinema.facility.service;

import com.uit.cinema.facility.dto.request.CinemaRequest;
import com.uit.cinema.facility.dto.response.CinemaResponse;

import java.util.List;

public interface CinemaService {
    List<CinemaResponse> getAllActiveCinemas();
    CinemaResponse getCinemaById(Long id);
    CinemaResponse createCinema(CinemaRequest request);
    CinemaResponse updateCinema(Long id, CinemaRequest request);
    void deleteCinema(Long id);
}
