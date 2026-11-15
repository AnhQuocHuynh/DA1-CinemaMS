package com.api.moviebooking.repositories;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.api.moviebooking.models.entities.UserRating;

public interface UserRatingRepository extends JpaRepository<UserRating, UUID> {

    List<UserRating> findByUserId(UUID userId);

    List<UserRating> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<UserRating> findFirstByUserIdAndMovieIdOrderByCreatedAtDesc(UUID userId, UUID movieId);

    @Query("SELECT DISTINCT ur.movie.id FROM UserRating ur WHERE ur.user.id = :userId")
    Set<UUID> findDistinctMovieIdsByUserId(@Param("userId") UUID userId);

    @Query("SELECT AVG(ur.ratingValue) FROM UserRating ur WHERE ur.user.id = :userId")
    Double findAverageRatingByUserId(@Param("userId") UUID userId);

    @Query("SELECT ur FROM UserRating ur JOIN FETCH ur.movie WHERE ur.user.id = :userId")
    List<UserRating> findByUserIdWithMovie(@Param("userId") UUID userId);

    // pageable version for listing with pagination
    Page<UserRating> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
}