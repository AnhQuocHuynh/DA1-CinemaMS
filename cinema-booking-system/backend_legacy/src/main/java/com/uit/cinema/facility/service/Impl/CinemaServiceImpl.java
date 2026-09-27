package com.uit.cinema.facility.service.Impl;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.core.exception.ErrorCode;
import com.uit.cinema.facility.dto.request.CinemaRequest;
import com.uit.cinema.facility.dto.response.CinemaResponse;
import com.uit.cinema.facility.entity.Cinema;
import com.uit.cinema.facility.entity.Room;
import com.uit.cinema.facility.mapper.CinemaMapper;
import com.uit.cinema.facility.repository.CinemaRepository;
import com.uit.cinema.facility.service.CinemaService;
import com.uit.cinema.facility.service.client.FacilityShowtimeGuard;
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
    private final FacilityShowtimeGuard facilityShowtimeGuard;

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
            .orElseThrow(() -> new CustomException("Cinema not found", HttpStatus.NOT_FOUND, "CINEMA_NOT_FOUND"));
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
    public CinemaResponse updateCinema(Long id, CinemaRequest request) {
        Cinema existing = getCinemaEntityById(id);
        cinemaMapper.updateEntity(existing, request);
        Cinema updated = cinemaRepository.save(existing);
        return cinemaMapper.toResponse(updated);
    }

    @Override
    @Transactional
    public void deleteCinema(Long id) {
        Cinema cinema = getCinemaEntityById(id);

        List<Long> roomIds = cinema.getRooms().stream()
            .filter(Room::isActive)
            .map(Room::getId)
            .collect(Collectors.toList());

        if (facilityShowtimeGuard.hasFutureShowtimesForRooms(roomIds)) {
            throw new CustomException(
                ErrorCode.CONFLICT,
                "Cinema cannot be deactivated while future showtimes are scheduled"
            );
        }

        cinema.setActive(false);
        cinemaRepository.save(cinema);
    }
}
