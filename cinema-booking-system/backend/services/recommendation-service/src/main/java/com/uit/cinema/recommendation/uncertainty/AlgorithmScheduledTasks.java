package com.uit.cinema.recommendation.uncertainty;

import com.uit.cinema.recommendation.client.CatalogFeatureClient;
import com.uit.cinema.recommendation.persistence.SystemConfig;
import com.uit.cinema.recommendation.persistence.SystemConfigRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
class MaxDissimilarityJob {

    private final CatalogFeatureClient catalogFeatureClient;
    private final SystemConfigRepository systemConfigRepository;
    private final MovieDissimilarityCalculator dissimilarityCalculator;

    @Transactional
    public void calculateAndStore() {
        List<MovieFeature> movies = catalogFeatureClient.loadAll();
        double maxDissimilarity = computeMax(movies);
        SystemConfig config = systemConfigRepository.findById(AlgorithmConfigKeys.MAX_MOVIE_DISSIMILARITY)
                .orElseGet(SystemConfig::new);
        config.setConfigKey(AlgorithmConfigKeys.MAX_MOVIE_DISSIMILARITY);
        config.setConfigValue(String.valueOf(maxDissimilarity));
        systemConfigRepository.save(config);
        log.info("MAX_MOVIE_DISSIMILARITY updated to {}", maxDissimilarity);
    }

    private double computeMax(List<MovieFeature> movies) {
        if (movies.size() < 2) {
            log.info("Using fallback MAX_MOVIE_DISSIMILARITY=1.0 due to insufficient movie count");
            return 1.0;
        }
        double maxDissimilarity = 0.0;
        for (int i = 0; i < movies.size() - 1; i++) {
            MovieFeature left = movies.get(i);
            for (int j = i + 1; j < movies.size(); j++) {
                double total = dissimilarityCalculator.calculateTotalDissimilarity(left, movies.get(j));
                if (total > maxDissimilarity) {
                    maxDissimilarity = total;
                }
            }
        }
        return maxDissimilarity;
    }
}

@Component
@RequiredArgsConstructor
@Slf4j
public class AlgorithmScheduledTasks {

    private static final long MAX_DISSIM_STALE_DAYS = 7L;

    private final SystemConfigRepository systemConfigRepository;
    private final MaxDissimilarityJob maxDissimilarityJob;

    @EventListener(ApplicationReadyEvent.class)
    public void initializeMaxMovieDissimilarityIfMissing() {
        try {
            Optional<SystemConfig> configOptional = systemConfigRepository.findById(AlgorithmConfigKeys.MAX_MOVIE_DISSIMILARITY);
            boolean shouldRecalculate = configOptional.isEmpty() || isConfigOlderThanDays(configOptional.get(), MAX_DISSIM_STALE_DAYS);
            if (!shouldRecalculate) {
                return;
            }
            maxDissimilarityJob.calculateAndStore();
        } catch (ResponseStatusException exception) {
            log.warn("Skip MAX_MOVIE_DISSIMILARITY startup recalculation because catalog is unavailable");
        } catch (RuntimeException exception) {
            log.warn("Skip MAX_MOVIE_DISSIMILARITY startup recalculation: {}", exception.getMessage());
        }
    }

    @Scheduled(cron = "0 0 3 * * MON")
    public void calculateAndStoreMaxMovieDissimilarity() {
        maxDissimilarityJob.calculateAndStore();
    }

    private boolean isConfigOlderThanDays(SystemConfig config, long days) {
        LocalDateTime updatedAt = config.getUpdatedAt();
        if (updatedAt == null) {
            return true;
        }
        return updatedAt.isBefore(LocalDateTime.now().minusDays(days));
    }
}
