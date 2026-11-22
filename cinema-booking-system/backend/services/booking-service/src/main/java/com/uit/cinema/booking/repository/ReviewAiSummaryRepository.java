package com.uit.cinema.booking.repository;

import com.uit.cinema.booking.entity.ReviewAiSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ReviewAiSummaryRepository extends JpaRepository<ReviewAiSummary, Long> {

    Optional<ReviewAiSummary> findByTargetKey(String targetKey);
}
