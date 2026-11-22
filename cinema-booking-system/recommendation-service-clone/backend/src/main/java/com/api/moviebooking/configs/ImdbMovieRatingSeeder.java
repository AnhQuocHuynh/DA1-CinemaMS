package com.api.moviebooking.configs;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.api.moviebooking.models.entities.Movie;
import com.api.moviebooking.models.entities.User;
import com.api.moviebooking.repositories.UserRepo;
import com.api.moviebooking.services.ImdbSyncService;
import com.api.moviebooking.services.UserRatingService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@Profile("!test")
@Order(20)
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "imdb.seed.enabled", havingValue = "true")
public class ImdbMovieRatingSeeder implements CommandLineRunner {

    private static final List<Double> DEFAULT_RATINGS = List.of(4.5, 4.0, 5.0, 3.5, 4.2, 4.8, 3.8, 4.1, 4.7, 4.4);

    private final ImdbSyncService imdbSyncService;
    private final UserRatingService userRatingService;
    private final UserRepo userRepo;

    @Value("${imdb.seed.admin-email:admin@gmail.com}")
    private String adminEmail;

    @Value("${imdb.seed.ids:tt12042730,tt15398776,tt9362722,tt10366206,tt5537002,tt9603212,tt3581920,tt6718170,tt1375666,tt0816692}")
    private String imdbSeedIdsRaw;

    @Override
    public void run(String... args) {
        User admin = userRepo.findByEmail(adminEmail)
                .orElse(null);

        if (admin == null) {
            log.warn("IMDb seed skipped: admin user not found with email {}", adminEmail);
            return;
        }

        List<String> imdbIds = parseImdbIds(imdbSeedIdsRaw);
        if (imdbIds.isEmpty()) {
            log.warn("IMDb seed skipped: imdb.seed.ids is empty");
            return;
        }

        UUID adminUserId = admin.getId();
        int syncedMovies = 0;
        int upsertedRatings = 0;

        log.info("IMDb seed starting for {} IDs with admin {}", imdbIds.size(), adminEmail);

        for (int index = 0; index < imdbIds.size(); index++) {
            String imdbId = imdbIds.get(index);

            try {
                Movie movie = imdbSyncService.syncMovieByImdbId(imdbId);
                syncedMovies++;

                double ratingValue = DEFAULT_RATINGS.get(index % DEFAULT_RATINGS.size());
                userRatingService.upsertUserRating(adminUserId, movie.getId(), ratingValue);
                upsertedRatings++;
            } catch (Exception exception) {
                log.warn("IMDb seed failed for {}: {}", imdbId, exception.getMessage());
            }
        }

        log.info("IMDb seed completed. syncedMovies={}, upsertedRatings={}", syncedMovies, upsertedRatings);
    }

    private List<String> parseImdbIds(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return List.of();
        }

        Set<String> uniqueIds = new LinkedHashSet<>();
        String[] tokens = rawValue.split(",");
        for (String token : tokens) {
            String imdbId = token == null ? null : token.trim();
            if (imdbId != null && !imdbId.isBlank()) {
                uniqueIds.add(imdbId);
            }
        }

        return new ArrayList<>(uniqueIds);
    }
}
