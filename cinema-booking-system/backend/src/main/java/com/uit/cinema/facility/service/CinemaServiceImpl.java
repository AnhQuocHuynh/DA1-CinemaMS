package com.uit.cinema.facility.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.facility.entity.Cinema;
import com.uit.cinema.facility.repository.CinemaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CinemaServiceImpl implements CinemaService {

    private final CinemaRepository cinemaRepository;

    @Override
    public List<Cinema> getAllActiveCinemas() {
        return cinemaRepository.findByActiveTrue();
    }

    @Override
    public Cinema getCinemaById(Long id) {
        return cinemaRepository.findById(id)
            .orElseThrow(() -> new CustomException("Rạp không tồn tại", HttpStatus.NOT_FOUND, "CINEMA_NOT_FOUND"));
    }

    @Override
    @Transactional
    public Cinema createCinema(Cinema cinema) {
        return cinemaRepository.save(cinema);
    }

    @Override
    @Transactional
    public void deleteCinema(Long id) {
        Cinema cinema = getCinemaById(id);
        cinema.setActive(false);
        cinemaRepository.save(cinema);
    }
}
