package com.uit.cinema.catalog.service.Impl;

import com.uit.cinema.catalog.config.CinemaAiProperties;
import com.uit.cinema.catalog.entity.Genre;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.catalog.service.MovieSummaryAgent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class MovieSummaryBackfillService {

    private final MovieRepository movieRepository;
    private final MovieSummaryAgent movieSummaryAgent;
    private final CinemaAiProperties properties;
    private final TransactionTemplate transactionTemplate;

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        if (!properties.isEnabled() || properties.getApiKey() == null || properties.getApiKey().isBlank()) {
            log.info("Cinema AI is disabled or API key is not configured. Skipping movie summary backfill.");
            return;
        }
        CompletableFuture.runAsync(this::backfillAllMissingSummaries);
    }

    public int backfillAllMissingSummaries() {
        log.info("Starting movie summary backfill check...");
        List<Movie> missing = movieRepository.findMoviesMissingAiSummary();
        if (missing.isEmpty()) {
            log.info("All movies in database already have AI summaries.");
            return 0;
        }

        log.info("Found {} movies without AI summary. Starting backfill...", missing.size());
        int count = 0;
        for (Movie movie : missing) {
            try {
                List<String> genreNames = movie.getGenres() != null
                        ? movie.getGenres().stream().map(Genre::getName).filter(Objects::nonNull).toList()
                        : List.of();
                String desc = movie.getDescription();
                if (desc == null || desc.isBlank()) {
                    desc = movie.getTitle();
                }

                var summaryOpt = movieSummaryAgent.summarize(movie.getTitle(), desc, genreNames);
                if (summaryOpt.isPresent() && !summaryOpt.get().isBlank()) {
                    String summary = summaryOpt.get();
                    transactionTemplate.executeWithoutResult(status -> {
                        Movie m = movieRepository.findById(movie.getId()).orElse(null);
                        if (m != null) {
                            m.setAiSummary(summary);
                            movieRepository.save(m);
                        }
                    });
                    count++;
                    log.info("Backfilled AI summary for movie ID {} ({}): {} words",
                            movie.getId(), movie.getTitle(), summary.trim().split("\\s+").length);
                }
                Thread.sleep(600);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception ex) {
                log.warn("Failed to generate AI summary during backfill for movie ID {} ({}): {}",
                        movie.getId(), movie.getTitle(), ex.getMessage());
            }
        }
        log.info("Movie summary backfill finished. Successfully updated {}/{} movies.", count, missing.size());
        return count;
    }
}

