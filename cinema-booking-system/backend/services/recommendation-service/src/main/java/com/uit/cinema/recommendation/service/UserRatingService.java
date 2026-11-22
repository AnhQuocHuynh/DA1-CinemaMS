package com.uit.cinema.recommendation.service;

import com.uit.cinema.recommendation.client.CatalogFeatureClient;
import com.uit.cinema.recommendation.dto.UserRatingPageResponse;
import com.uit.cinema.recommendation.dto.UserRatingResponse;
import com.uit.cinema.recommendation.persistence.UserRating;
import com.uit.cinema.recommendation.persistence.UserRatingRepository;
import com.uit.cinema.recommendation.uncertainty.MovieFeature;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserRatingService {

    private static final double DEFAULT_USER_MEAN = 3.0;

    private final UserRatingRepository userRatingRepository;
    private final CatalogFeatureClient catalogFeatureClient;

    @Transactional
    public UserRatingResponse upsert(Long userId, Long movieId, Double ratingValue) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED");
        }
        if (movieId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "MOVIE_ID_REQUIRED");
        }
        if (ratingValue == null || ratingValue < 1.0 || ratingValue > 5.0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "RATING_OUT_OF_RANGE");
        }

        MovieFeature feature = catalogFeatureClient.requireFeature(movieId);
        UserRating rating = userRatingRepository
                .findFirstByUserIdAndMovieIdOrderByCreatedAtDesc(userId, movieId)
                .orElseGet(UserRating::new);
        rating.setUserId(userId);
        rating.setMovieId(feature.id());
        rating.setMovieTitle(feature.title());
        rating.setPosterUrl(feature.posterUrl());
        rating.setRatingValue(clamp(ratingValue));
        rating.setDurationMinutes(feature.durationMinutes());
        rating.setReleaseYear(feature.releaseYear());
        rating.setImdbRating(feature.imdbRating());
        rating.setRegion(feature.region());
        rating.setLanguage(feature.language());
        rating.setGenreCsv(feature.genreCsv());
        return toResponse(userRatingRepository.save(rating));
    }

    public List<UserRatingResponse> listMine(Long userId) {
        return userRatingRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::toResponse)
                .toList();
    }

    public UserRatingPageResponse listMinePage(Long userId, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.min(50, Math.max(1, size));
        Page<UserRatingResponse> result = userRatingRepository
                .findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(safePage, safeSize))
                .map(this::toResponse);
        return new UserRatingPageResponse(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages());
    }

    @Transactional
    public void delete(Long userId, Long movieId) {
        UserRating rating = userRatingRepository
                .findFirstByUserIdAndMovieIdOrderByCreatedAtDesc(userId, movieId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "RATING_NOT_FOUND"));
        userRatingRepository.delete(rating);
    }

    public double averageRating(Long userId) {
        Double mean = userRatingRepository.findAverageRatingByUserId(userId);
        return mean == null ? DEFAULT_USER_MEAN : clamp(mean);
    }

    public MovieFeature snapshotOf(UserRating rating) {
        return new MovieFeature(
                rating.getMovieId(),
                rating.getMovieTitle(),
                rating.getPosterUrl(),
                rating.getDurationMinutes(),
                rating.getReleaseYear(),
                rating.getImdbRating(),
                rating.getRegion(),
                rating.getLanguage(),
                rating.getGenreCsv(),
                "SHOWING",
                null);
    }

    private UserRatingResponse toResponse(UserRating rating) {
        return new UserRatingResponse(
                rating.getRatingId(),
                rating.getMovieId(),
                rating.getMovieTitle(),
                rating.getPosterUrl(),
                rating.getRatingValue(),
                rating.getCreatedAt());
    }

    private double clamp(Double ratingValue) {
        if (ratingValue == null) {
            return DEFAULT_USER_MEAN;
        }
        return Math.max(1.0, Math.min(5.0, ratingValue));
    }
}
