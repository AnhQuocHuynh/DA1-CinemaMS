package com.uit.cinema.recommendation.persistence;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRatingRepository extends JpaRepository<UserRating, Long> {

    Optional<UserRating> findFirstByUserIdAndMovieIdOrderByCreatedAtDesc(Long userId, Long movieId);

    List<UserRating> findByUserIdOrderByCreatedAtDesc(Long userId);

    Page<UserRating> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    @Query("SELECT AVG(r.ratingValue) FROM UserRating r WHERE r.userId = :userId")
    Double findAverageRatingByUserId(@Param("userId") Long userId);
}
