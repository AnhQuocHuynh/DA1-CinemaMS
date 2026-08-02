package com.uit.cinema.recommendation.graph;

import com.uit.cinema.recommendation.dto.MovieRecommendation;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Session;
import org.neo4j.driver.Values;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

@Repository
@ConditionalOnProperty(name = "recommendation.graph.enabled", havingValue = "true")
public class Neo4jRecommendationGraphStore implements RecommendationGraphStore {

    private static final String POPULAR_QUERY = """
        MATCH (movie:Movie {active: true})
        OPTIONAL MATCH ()-[watched:WATCHED]->(movie)
        WITH movie, count(DISTINCT watched) AS bookingCount
        OPTIONAL MATCH ()-[rated:RATED]->(movie)
        WITH movie, bookingCount, coalesce(avg(rated.rating), 0.0) AS avgRating
        OPTIONAL MATCH (movie)-[:IN_GENRE]->(genre:Genre)
        WITH movie, bookingCount, avgRating, collect(DISTINCT genre.name) AS genres
        RETURN movie.movieId AS movieId,
               movie.title AS title,
               movie.posterUrl AS posterUrl,
               toFloat(bookingCount) + avgRating AS score,
               genres,
               avgRating,
               bookingCount
        ORDER BY bookingCount DESC, avgRating DESC, movie.movieId ASC
        LIMIT $limit
        """;

    private static final String PERSONALIZED_QUERY = """
        MATCH (user:User {userId: $userId})
        OPTIONAL MATCH (user)-[:WATCHED|RATED]->(seen:Movie)-[:IN_GENRE]->(preferred:Genre)
        WITH user, collect(DISTINCT preferred.name) AS preferredGenres
        MATCH (candidate:Movie {active: true})-[:IN_GENRE]->(matched:Genre)
        WHERE matched.name IN preferredGenres
          AND NOT (user)-[:WATCHED]->(candidate)
        WITH candidate,
             count(DISTINCT matched) AS sharedGenreCount,
             collect(DISTINCT matched.name) AS genres
        OPTIONAL MATCH ()-[watched:WATCHED]->(candidate)
        WITH candidate, sharedGenreCount, genres, count(DISTINCT watched) AS bookingCount
        OPTIONAL MATCH ()-[rated:RATED]->(candidate)
        WITH candidate, sharedGenreCount, genres, bookingCount,
             coalesce(avg(rated.rating), 0.0) AS avgRating
        RETURN candidate.movieId AS movieId,
               candidate.title AS title,
               candidate.posterUrl AS posterUrl,
               sharedGenreCount * 10.0 + bookingCount * 0.1 + avgRating AS score,
               genres,
               avgRating,
               bookingCount
        ORDER BY score DESC, candidate.movieId ASC
        LIMIT $limit
        """;

    private static final String SIMILAR_QUERY = """
        MATCH (source:Movie {movieId: $movieId})-[:IN_GENRE]->(genre:Genre)
        MATCH (candidate:Movie {active: true})-[:IN_GENRE]->(genre)
        WHERE candidate.movieId <> source.movieId
        WITH candidate,
             count(DISTINCT genre) AS sharedGenreCount,
             collect(DISTINCT genre.name) AS genres
        OPTIONAL MATCH ()-[watched:WATCHED]->(candidate)
        WITH candidate, sharedGenreCount, genres, count(DISTINCT watched) AS bookingCount
        OPTIONAL MATCH ()-[rated:RATED]->(candidate)
        WITH candidate, sharedGenreCount, genres, bookingCount,
             coalesce(avg(rated.rating), 0.0) AS avgRating
        RETURN candidate.movieId AS movieId,
               candidate.title AS title,
               candidate.posterUrl AS posterUrl,
               sharedGenreCount * 10.0 + avgRating AS score,
               genres,
               avgRating,
               bookingCount
        ORDER BY score DESC, candidate.movieId ASC
        LIMIT $limit
        """;

    private static final String TASTE_QUERY = """
        MATCH (user:User {userId: $userId})
        OPTIONAL MATCH (user)-[:WATCHED]->(watched:Movie)
        WITH user, count(DISTINCT watched) AS watchedMovies
        OPTIONAL MATCH (user)-[:WATCHED|RATED]->(:Movie)-[:IN_GENRE]->(genre:Genre)
        WITH watchedMovies, genre.name AS genreName, count(*) AS affinity
        ORDER BY affinity DESC, genreName ASC
        RETURN watchedMovies,
               [name IN collect(genreName) WHERE name IS NOT NULL][0..5] AS preferredGenres
        """;

    private final Driver driver;

    public Neo4jRecommendationGraphStore(Driver driver) {
        this.driver = driver;
    }

    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    public List<MovieRecommendation> findForUser(long userId, int limit) {
        return queryMovies(PERSONALIZED_QUERY, Map.of("userId", userId, "limit", limit), "PREFERRED_GENRES");
    }

    @Override
    public List<MovieRecommendation> findPopular(int limit) {
        return queryMovies(POPULAR_QUERY, Map.of("limit", limit), "POPULAR_NOW");
    }

    @Override
    public List<MovieRecommendation> findSimilar(long movieId, int limit) {
        return queryMovies(SIMILAR_QUERY, Map.of("movieId", movieId, "limit", limit), "SHARED_GENRES");
    }

    @Override
    public UserTasteProfile findTasteProfile(long userId) {
        try (Session session = driver.session()) {
            return session.executeRead(transaction -> {
                List<Record> records = transaction.run(TASTE_QUERY, Values.value(Map.of("userId", userId))).list();
                if (records.isEmpty()) {
                    return UserTasteProfile.empty();
                }
                Record record = records.getFirst();
                return new UserTasteProfile(
                    record.get("preferredGenres").asList(value -> value.asString()),
                    record.get("watchedMovies").asLong()
                );
            });
        }
    }

    private List<MovieRecommendation> queryMovies(String query, Map<String, Object> parameters, String reason) {
        try (Session session = driver.session()) {
            return session.executeRead(transaction -> transaction.run(query, Values.value(parameters))
                .list(record -> mapRecommendation(record, reason)));
        }
    }

    private MovieRecommendation mapRecommendation(Record record, String reason) {
        String posterUrl = record.get("posterUrl").isNull() ? null : record.get("posterUrl").asString();
        return new MovieRecommendation(
            record.get("movieId").asLong(),
            record.get("title").asString(),
            posterUrl,
            decimal(record.get("score").asDouble()),
            reason,
            record.get("genres").asList(value -> value.asString()),
            decimal(record.get("avgRating").asDouble()),
            record.get("bookingCount").asLong()
        );
    }

    private BigDecimal decimal(double value) {
        return BigDecimal.valueOf(value).setScale(4, RoundingMode.HALF_UP);
    }
}
