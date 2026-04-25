package com.uit.cinema.facility.service;

import com.uit.cinema.facility.entity.Cinema;

import java.util.List;

public interface CinemaService {
    List<Cinema> getAllActiveCinemas();
    Cinema getCinemaById(Long id);
    Cinema createCinema(Cinema cinema);
    void deleteCinema(Long id);
}
