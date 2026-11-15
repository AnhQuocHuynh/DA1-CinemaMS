package com.uit.cinema.booking.service.Impl;

import com.uit.cinema.booking.entity.ReviewAiSummary;
import com.uit.cinema.booking.repository.ReviewAiSummaryRepository;
import com.uit.cinema.booking.service.ReviewSummaryCache;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class JpaReviewSummaryCache implements ReviewSummaryCache {

    private final ReviewAiSummaryRepository repository;

    @Override
    @Transactional(readOnly = true)
    public Optional<ReviewAiSummary> find(String targetKey) {
        return repository.findByTargetKey(targetKey);
    }

    @Override
    @Transactional
    public void save(ReviewAiSummary row) {
        repository.save(row);
    }
}
