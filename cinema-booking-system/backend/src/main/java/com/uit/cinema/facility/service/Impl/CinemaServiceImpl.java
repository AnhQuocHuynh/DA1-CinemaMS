package com.uit.cinema.facility.service.Impl;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.facility.dto.request.CinemaRequest;
import com.uit.cinema.facility.dto.response.CinemaResponse;
import com.uit.cinema.facility.entity.Cinema;
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

    @Override
    public List<CinemaResponse> getAllActiveCinemas() {
        return cinemaRepository.findByActiveTrue().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public CinemaResponse getCinemaById(Long id) {
        Cinema cinema = getCinemaEntityById(id);
        return mapToResponse(cinema);
    }

    private Cinema getCinemaEntityById(Long id) {
        return cinemaRepository.findById(id)
            .orElseThrow(() -> new CustomException("Rạp không tồn tại", HttpStatus.NOT_FOUND, "CINEMA_NOT_FOUND"));
    }

    @Override
    @Transactional
    public CinemaResponse createCinema(CinemaRequest request) {
        Cinema cinema = Cinema.builder()
                .name(request.getName())
                .address(request.getAddress())
                .city(request.getCity())
                .phone(request.getPhone())
                .active(request.isActive())
                .build();
        Cinema savedCinema = cinemaRepository.save(cinema);
        return mapToResponse(savedCinema);
    }

    @Override
    @Transactional
    public void deleteCinema(Long id) {
        Cinema cinema = getCinemaEntityById(id);
        cinema.setActive(false);
        cinemaRepository.save(cinema);
    }

    private CinemaResponse mapToResponse(Cinema cinema) {
        return CinemaResponse.builder()
                .id(cinema.getId())
                .name(cinema.getName())
                .address(cinema.getAddress())
                .city(cinema.getCity())
                .phone(cinema.getPhone())
                .active(cinema.isActive())
                .build();
    }
}
