package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.dto.request.GenreRequest;
import com.uit.cinema.catalog.dto.response.GenreResponse;
import com.uit.cinema.catalog.entity.Genre;
import com.uit.cinema.catalog.repository.GenreRepository;
import com.uit.cinema.catalog.service.GenreService;
import com.uit.cinema.core.exception.CustomException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GenreServiceImpl implements GenreService {

    private final GenreRepository genreRepository;

    @Override
    public List<GenreResponse> getAllGenres() {
        return genreRepository.findAll().stream()
                .map(genre -> GenreResponse.builder()
                        .id(genre.getId())
                        .name(genre.getName())
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public GenreResponse createGenre(GenreRequest request) {
        String normalizedName = request.getName().trim().toLowerCase();
        
        if (genreRepository.findByNameIgnoreCase(normalizedName).isPresent()) {
            throw new CustomException("Thể loại đã tồn tại", HttpStatus.BAD_REQUEST, "GENRE_EXISTS");
        }
        Genre genre = Genre.builder().name(normalizedName).build();
        Genre saved = genreRepository.save(genre);
        return GenreResponse.builder().id(saved.getId()).name(saved.getName()).build();
    }

    @Override
    @Transactional
    public void deleteGenre(Long id) {
        Genre genre = genreRepository.findById(id)
                .orElseThrow(() -> new CustomException("Thể loại không tồn tại", HttpStatus.NOT_FOUND, "GENRE_NOT_FOUND"));
        genreRepository.delete(genre);
    }
}
