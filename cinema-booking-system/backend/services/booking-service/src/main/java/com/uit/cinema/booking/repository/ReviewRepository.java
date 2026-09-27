package com.uit.cinema.booking.repository;

import com.uit.cinema.booking.entity.Review;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Long> {

    boolean existsByUserIdAndMovieId(Long userId, Long movieId);

    boolean existsByUserIdAndEventId(Long userId, Long eventId);

    List<Review> findByMovieIdAndStatusOrderByCreatedAtDesc(Long movieId, Review.ReviewStatus status);

    List<Review> findByEventIdAndStatusOrderByCreatedAtDesc(Long eventId, Review.ReviewStatus status);
}
