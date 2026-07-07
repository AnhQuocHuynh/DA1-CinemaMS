package com.uit.cinema.booking.dto.response;

import com.uit.cinema.booking.entity.Review;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ReviewResponse {
    private Long id;
    private Long userId;
    private Long movieId;
    private Long eventId;
    private Integer rating;
    private String comment;
    private Review.ReviewStatus status;
    private LocalDateTime createdAt;
}
