package com.api.moviebooking.services;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.api.moviebooking.helpers.constants.AlgorithmConfigKeys;
import com.api.moviebooking.models.entities.Movie;
import com.api.moviebooking.models.entities.SystemConfig;
import com.api.moviebooking.repositories.MovieRepo;
import com.api.moviebooking.repositories.SystemConfigRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class AlgorithmScheduledTasks {

    private static final long MAX_DISSIM_STALE_DAYS = 7L;

    private final MovieRepo movieRepo;
    private final SystemConfigRepository systemConfigRepository;
    private final MovieDissimilarityCalculator dissimilarityCalculator;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void initializeMaxMovieDissimilarityIfMissing() {
        Optional<SystemConfig> configOptional = systemConfigRepository
            .findById(AlgorithmConfigKeys.MAX_MOVIE_DISSIMILARITY);

        boolean shouldRecalculate = configOptional.isEmpty()
            || isConfigOlderThanDays(configOptional.get(), MAX_DISSIM_STALE_DAYS);

        if (!shouldRecalculate) {
            return;
        }

        double maxDissimilarity = computeMaxMovieDissimilarity();
        upsertMaxDissimilarity(maxDissimilarity);
        log.info("MAX_MOVIE_DISSIMILARITY recalculated at startup to {}", maxDissimilarity);
    }

    /**
     * Weekly batch job: 3 AM every Monday.
     * Computes the maximum movie-to-movie dissimilarity in the catalog and stores it
     * as MAX_MOVIE_DISSIMILARITY.
     */
    @Scheduled(cron = "0 0 3 * * MON")
    @Transactional
    public void calculateAndStoreMaxMovieDissimilarity() {
        double maxDissimilarity = computeMaxMovieDissimilarity();
        upsertMaxDissimilarity(maxDissimilarity);
        log.info("MAX_MOVIE_DISSIMILARITY updated to {}", maxDissimilarity);
    }

    private double computeMaxMovieDissimilarity() {
        List<Movie> movies = movieRepo.findAll();

        if (movies.size() < 2) {
            log.info("Using fallback MAX_MOVIE_DISSIMILARITY=1.0 due to insufficient movie count");
            return 1.0;
        }

        double maxDissimilarity = 0.0;

        // O(n^2) pairwise scan; can be optimized later by sampling/ANN if catalog grows.
        for (int i = 0; i < movies.size() - 1; i++) {
            Movie left = movies.get(i);
            for (int j = i + 1; j < movies.size(); j++) {
                Movie right = movies.get(j);
                double totalDissimilarity = dissimilarityCalculator.calculateTotalDissimilarity(left, right);
                if (totalDissimilarity > maxDissimilarity) {
                    maxDissimilarity = totalDissimilarity;
                }
            }
        }

        return maxDissimilarity;
    }

    private void upsertMaxDissimilarity(double maxDissimilarity) {
        SystemConfig config = systemConfigRepository
                .findById(AlgorithmConfigKeys.MAX_MOVIE_DISSIMILARITY)
                .orElseGet(SystemConfig::new);

        config.setConfigKey(AlgorithmConfigKeys.MAX_MOVIE_DISSIMILARITY);
        config.setConfigValue(String.valueOf(maxDissimilarity));

        systemConfigRepository.save(config);
    }

    private boolean isConfigOlderThanDays(SystemConfig config, long days) {
        LocalDateTime updatedAt = config.getUpdatedAt();
        if (updatedAt == null) {
            return true;
        }

        return updatedAt.isBefore(LocalDateTime.now().minusDays(days));
    }
}
