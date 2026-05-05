package com.uit.cinema.facility.service.Impl;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.facility.dto.request.CinemaRequest;
import com.uit.cinema.facility.dto.response.CinemaResponse;
import com.uit.cinema.facility.entity.Cinema;
import com.uit.cinema.facility.mapper.CinemaMapper;
import com.uit.cinema.facility.repository.CinemaRepository;
import com.uit.cinema.facility.service.CinemaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CinemaServiceImpl implements CinemaService {

    private final CinemaRepository cinemaRepository;
    private final CinemaMapper cinemaMapper;

    @Override
    public List<CinemaResponse> getAllActiveCinemas() {
        return cinemaRepository.findByActiveTrue().stream()
                .map(cinemaMapper::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    public CinemaResponse getCinemaById(Long id) {
        Cinema cinema = getCinemaEntityById(id);
        return cinemaMapper.toResponse(cinema);
    }

    private Cinema getCinemaEntityById(Long id) {
        return cinemaRepository.findById(id)
            .orElseThrow(() -> new CustomException("Rạp không tồn tại", HttpStatus.NOT_FOUND, "CINEMA_NOT_FOUND"));
    }

    @Override
    @Transactional
    public CinemaResponse createCinema(CinemaRequest request) {
        Cinema cinema = cinemaMapper.toEntity(request);
        Cinema savedCinema = cinemaRepository.save(cinema);
        return cinemaMapper.toResponse(savedCinema);
    }

    @Override
    @Transactional
    public void deleteCinema(Long id) {
        Cinema cinema = getCinemaEntityById(id);
        cinema.setActive(false);
        cinemaRepository.save(cinema);
    }
}
