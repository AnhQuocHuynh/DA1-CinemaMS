package com.api.moviebooking.services;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.api.moviebooking.helpers.exceptions.ResourceNotFoundException;
import com.api.moviebooking.models.dtos.recommendation.UserRatingDTO;
import com.api.moviebooking.models.entities.Movie;
import com.api.moviebooking.models.entities.User;
import com.api.moviebooking.models.entities.UserRating;
import com.api.moviebooking.repositories.MovieRepo;
import com.api.moviebooking.repositories.UserRatingRepository;
import com.api.moviebooking.repositories.UserRepo;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserRatingService {

    private static final double DEFAULT_USER_MEAN = 3.0;

    private final UserRatingRepository userRatingRepository;
    private final UserRepo userRepo;
    private final MovieRepo movieRepo;

    @Transactional
    public UserRatingDTO upsertUserRating(UUID userId, UUID movieId, Double ratingValue) {
        if (movieId == null) {
            throw new IllegalArgumentException("movieId must not be null");
        }
        if (ratingValue == null || ratingValue < 1.0 || ratingValue > 5.0) {
            throw new IllegalArgumentException("ratingValue must be in range [1.0, 5.0]");
        }

        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
        Movie movie = movieRepo.findById(movieId)
                .orElseThrow(() -> new ResourceNotFoundException("Movie", "id", movieId));

        UserRating rating = userRatingRepository
                .findFirstByUserIdAndMovieIdOrderByCreatedAtDesc(userId, movieId)
                .orElseGet(UserRating::new);

        rating.setUser(user);
        rating.setMovie(movie);
        rating.setRatingValue(clampRating(ratingValue));

        UserRating savedRating = userRatingRepository.save(rating);
        return toUserRatingDTO(savedRating);
    }

    public List<UserRatingDTO> getUserRatings(UUID userId) {
        return userRatingRepository.findByUserIdWithMovie(userId)
                .stream()
                .sorted(Comparator.comparing(UserRating::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toUserRatingDTO)
                .toList();
    }

    public Page<UserRatingDTO> getUserRatingsPage(UUID userId, int page, int size) {
        PageRequest pr = PageRequest.of(Math.max(0, page), Math.max(1, size));
        return userRatingRepository.findByUserIdOrderByCreatedAtDesc(userId, pr)
                .map(this::toUserRatingDTO);
    }

    @Transactional
    public void deleteUserRating(UUID userId, UUID movieId) {
        UserRating rating = userRatingRepository
                .findFirstByUserIdAndMovieIdOrderByCreatedAtDesc(userId, movieId)
                .orElseThrow(() -> new ResourceNotFoundException("UserRating", "movieId", movieId));

        userRatingRepository.delete(rating);
    }

    public Double getUserAverageRating(UUID userId) {
        Double meanRatingFromDb = userRatingRepository.findAverageRatingByUserId(userId);
        return meanRatingFromDb == null ? DEFAULT_USER_MEAN : clampRating(meanRatingFromDb);
    }

    private UserRatingDTO toUserRatingDTO(UserRating userRating) {
        Movie movie = userRating.getMovie();
        return UserRatingDTO.builder()
                .ratingId(userRating.getRatingId())
                .movieId(movie != null ? movie.getId() : null)
                .movieTitle(movie != null ? movie.getTitle() : null)
                .posterUrl(movie != null ? movie.getPosterUrl() : null)
                .ratingValue(userRating.getRatingValue())
                .createdAt(userRating.getCreatedAt())
                .build();
    }

    private double clampRating(Double ratingValue) {
        if (ratingValue == null) {
            return DEFAULT_USER_MEAN;
        }
        return Math.max(1.0, Math.min(5.0, ratingValue));
    }
}
