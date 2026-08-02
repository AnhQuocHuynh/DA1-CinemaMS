package com.uit.cinema.recommendation.backfill;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.uit.cinema.recommendation.messaging.RecommendationEventProjectionStore;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@ConditionalOnProperty(
    name = {"recommendation.backfill.enabled", "recommendation.graph.enabled"},
    havingValue = "true"
)
public class RecommendationGraphBackfillRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(RecommendationGraphBackfillRunner.class);
    static final String REQUIRED_CONFIRMATION = "BACKFILL-COPIED-LEGACY-TO-RECOMMENDATION";

    private static final String MOVIE_GENRES_SQL = """
        SELECT movie_genres.movie_id, genres.name
        FROM movie_genres
        JOIN genres ON genres.id = movie_genres.genre_id
        ORDER BY movie_genres.movie_id, genres.name
        """;

    private static final String MOVIES_SQL = """
        SELECT id, title, poster_url, active,
               COALESCE(updated_at, created_at, TIMESTAMP '1970-01-01 00:00:00') AS occurred_at
        FROM movies
        ORDER BY id
        """;

    private static final String ORDERS_SQL = """
        SELECT orders.id,
               orders.user_id,
               orders.showtime_id,
               orders.status,
               showtimes.movie_id,
               COALESCE(orders.updated_at, orders.created_at, TIMESTAMP '1970-01-01 00:00:00') AS occurred_at
        FROM orders
        LEFT JOIN showtimes ON showtimes.id = orders.showtime_id
        WHERE orders.status IN ('PAID', 'REFUNDED')
        ORDER BY orders.id
        """;

    private static final String REVIEWS_SQL = """
        SELECT id, user_id, movie_id, event_id, rating, status,
               COALESCE(updated_at, created_at, TIMESTAMP '1970-01-01 00:00:00') AS occurred_at
        FROM reviews
        ORDER BY id
        """;

    private final ObjectMapper objectMapper;
    private final RecommendationEventProjectionStore projectionStore;
    private final Driver graphDriver;
    private final boolean dryRun;
    private final String confirmation;
    private final String sourceUrl;
    private final String sourceUsername;
    private final String sourcePassword;
    private final int fetchSize;

    public RecommendationGraphBackfillRunner(
        ObjectMapper objectMapper,
        RecommendationEventProjectionStore projectionStore,
        Driver graphDriver,
        @Value("${recommendation.backfill.dry-run:true}") boolean dryRun,
        @Value("${recommendation.backfill.confirmation:}") String confirmation,
        @Value("${recommendation.backfill.source.url}") String sourceUrl,
        @Value("${recommendation.backfill.source.username}") String sourceUsername,
        @Value("${recommendation.backfill.source.password:}") String sourcePassword,
        @Value("${recommendation.backfill.fetch-size:500}") int fetchSize
    ) {
        this.objectMapper = objectMapper;
        this.projectionStore = projectionStore;
        this.graphDriver = graphDriver;
        this.dryRun = dryRun;
        this.confirmation = confirmation;
        this.sourceUrl = sourceUrl;
        this.sourceUsername = sourceUsername;
        this.sourcePassword = sourcePassword;
        this.fetchSize = Math.max(1, Math.min(fetchSize, 5000));
    }

    @Override
    public void run(ApplicationArguments arguments) throws Exception {
        requireExplicitConfirmation();
        BackfillStats stats = new BackfillStats();

        try (Connection connection = DriverManager.getConnection(sourceUrl, sourceUsername, sourcePassword)) {
            connection.setReadOnly(true);
            connection.setAutoCommit(false);
            Map<Long, List<String>> genresByMovie = loadMovieGenres(connection);
            backfillMovies(connection, genresByMovie, stats);
            backfillOrders(connection, stats);
            backfillReviews(connection, stats);
            connection.rollback();
        }

        log.info(
            "Recommendation graph backfill {}: movies={}, paidMovieOrders={}, refunds={}, movieReviews={}, projected={}, duplicates={}",
            dryRun ? "dry-run complete" : "complete",
            stats.movies,
            stats.paidMovieOrders,
            stats.refunds,
            stats.movieReviews,
            stats.projected,
            stats.duplicates
        );

        if (!dryRun) {
            verifyMinimumGraphCounts(stats);
        }
    }

    private void requireExplicitConfirmation() {
        if (!dryRun && !REQUIRED_CONFIRMATION.equals(confirmation)) {
            throw new IllegalStateException(
                "Non-dry-run recommendation backfill requires confirmation: " + REQUIRED_CONFIRMATION
            );
        }
    }

    private Map<Long, List<String>> loadMovieGenres(Connection connection) throws SQLException {
        Map<Long, List<String>> genresByMovie = new HashMap<>();
        try (PreparedStatement statement = prepare(connection, MOVIE_GENRES_SQL);
             ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                genresByMovie.computeIfAbsent(rows.getLong("movie_id"), ignored -> new ArrayList<>())
                    .add(rows.getString("name"));
            }
        }
        return genresByMovie;
    }

    private void backfillMovies(
        Connection connection,
        Map<Long, List<String>> genresByMovie,
        BackfillStats stats
    ) throws SQLException {
        try (PreparedStatement statement = prepare(connection, MOVIES_SQL);
             ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                long movieId = rows.getLong("id");
                Instant occurredAt = instant(rows, "occurred_at");
                ObjectNode payload = objectMapper.createObjectNode();
                payload.put("movieId", movieId);
                payload.put("title", rows.getString("title"));
                putNullable(payload, "posterUrl", rows.getString("poster_url"));
                payload.put("active", rows.getBoolean("active"));
                ArrayNode genres = payload.putArray("genreNames");
                genresByMovie.getOrDefault(movieId, List.of()).forEach(genres::add);

                project("catalog-service", "movie.updated", "movie", movieId, occurredAt, payload, stats);
                stats.movies++;
            }
        }
    }

    private void backfillOrders(Connection connection, BackfillStats stats) throws SQLException {
        try (PreparedStatement statement = prepare(connection, ORDERS_SQL);
             ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                long orderId = rows.getLong("id");
                String status = rows.getString("status");
                Instant occurredAt = instant(rows, "occurred_at");
                ObjectNode payload = objectMapper.createObjectNode();
                payload.put("orderId", orderId);
                payload.put("userId", rows.getLong("user_id"));
                payload.put("showtimeId", rows.getLong("showtime_id"));
                putNullable(payload, "movieId", nullableLong(rows, "movie_id"));

                String eventType = "REFUNDED".equals(status) ? "order.refunded" : "order.paid";
                project("booking-service", eventType, "order", orderId, occurredAt, payload, stats);
                if ("REFUNDED".equals(status)) {
                    stats.refunds++;
                } else if (nullableLong(rows, "movie_id") != null) {
                    stats.paidMovieOrders++;
                }
            }
        }
    }

    private void backfillReviews(Connection connection, BackfillStats stats) throws SQLException {
        try (PreparedStatement statement = prepare(connection, REVIEWS_SQL);
             ResultSet rows = statement.executeQuery()) {
            while (rows.next()) {
                long reviewId = rows.getLong("id");
                Instant occurredAt = instant(rows, "occurred_at");
                Long movieId = nullableLong(rows, "movie_id");
                ObjectNode payload = objectMapper.createObjectNode();
                payload.put("reviewId", reviewId);
                payload.put("userId", rows.getLong("user_id"));
                putNullable(payload, "movieId", movieId);
                putNullable(payload, "eventId", nullableLong(rows, "event_id"));
                payload.put("rating", rows.getInt("rating"));
                payload.put("status", rows.getString("status"));

                project("booking-service", "review.created", "review", reviewId, occurredAt, payload, stats);
                if (movieId != null && "VISIBLE".equals(rows.getString("status"))) {
                    stats.movieReviews++;
                }
            }
        }
    }

    private void project(
        String source,
        String eventType,
        String aggregateType,
        long aggregateId,
        Instant occurredAt,
        ObjectNode payload,
        BackfillStats stats
    ) {
        if (dryRun) {
            return;
        }
        ObjectNode envelope = objectMapper.createObjectNode();
        envelope.put("eventId", deterministicEventId(aggregateType, aggregateId, eventType, occurredAt).toString());
        envelope.put("eventType", eventType);
        envelope.put("occurredAt", occurredAt.toString());
        envelope.put("schemaVersion", 1);
        envelope.put("source", source);
        envelope.set("payload", payload);

        if (projectionStore.project(envelope)) {
            stats.projected++;
        } else {
            stats.duplicates++;
        }
    }

    private UUID deterministicEventId(
        String aggregateType,
        long aggregateId,
        String eventType,
        Instant occurredAt
    ) {
        String key = "recommendation-backfill:" + aggregateType + ":" + aggregateId + ":"
            + eventType + ":" + occurredAt;
        return UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8));
    }

    private void verifyMinimumGraphCounts(BackfillStats stats) {
        try (Session session = graphDriver.session()) {
            long movies = count(session, "MATCH (movie:Movie) RETURN count(movie)");
            long watched = count(session, "MATCH ()-[watched:WATCHED]->() RETURN count(watched)");
            long rated = count(session, "MATCH ()-[rated:RATED]->() RETURN count(rated)");

            if (movies < stats.movies || watched < stats.paidMovieOrders || rated < stats.movieReviews) {
                throw new IllegalStateException(
                    "Recommendation graph verification failed: graph counts are below copied source counts"
                );
            }
            log.info(
                "Recommendation graph verification passed: movies={}, watched={}, rated={}",
                movies,
                watched,
                rated
            );
        }
    }

    private long count(Session session, String query) {
        return session.run(query).single().get(0).asLong();
    }

    private PreparedStatement prepare(Connection connection, String sql) throws SQLException {
        PreparedStatement statement = connection.prepareStatement(sql);
        statement.setFetchSize(fetchSize);
        return statement;
    }

    private Instant instant(ResultSet rows, String column) throws SQLException {
        Timestamp timestamp = rows.getTimestamp(column);
        return timestamp == null ? Instant.EPOCH : timestamp.toInstant();
    }

    private Long nullableLong(ResultSet rows, String column) throws SQLException {
        long value = rows.getLong(column);
        return rows.wasNull() ? null : value;
    }

    private void putNullable(ObjectNode payload, String field, String value) {
        if (value == null) {
            payload.putNull(field);
        } else {
            payload.put(field, value);
        }
    }

    private void putNullable(ObjectNode payload, String field, Long value) {
        if (value == null) {
            payload.putNull(field);
        } else {
            payload.put(field, value);
        }
    }

    private static final class BackfillStats {
        private int movies;
        private int paidMovieOrders;
        private int refunds;
        private int movieReviews;
        private int projected;
        private int duplicates;
    }
}
