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
import jakarta.persistence.EntityManager;
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
    private final EntityManager entityManager;

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

        if (!roomIds.isEmpty()) {
            Long count = entityManager.createQuery(
                "SELECT COUNT(s) FROM Showtime s WHERE s.roomId IN :roomIds AND s.startTime > :now AND s.status <> 'CANCELLED'",
                Long.class
            )
            .setParameter("roomIds", roomIds)
            .setParameter("now", java.time.LocalDateTime.now())
            .getSingleResult();
            
            if (count > 0) {
                throw new CustomException(
                    ErrorCode.CONFLICT,
                    "Không thể ngừng hoạt động rạp này vì vẫn còn suất chiếu đang hoạt động trong tương lai"
                );
            }
        }
        
        cinema.setActive(false);
        cinemaRepository.save(cinema);
    }
}
