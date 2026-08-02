package com.uit.cinema.recommendation.graph;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.uit.cinema.recommendation.messaging.Neo4jRecommendationEventProjectionStore;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.neo4j.driver.Session;
import org.neo4j.harness.Neo4j;
import org.neo4j.harness.Neo4jBuilders;

import static org.assertj.core.api.Assertions.assertThat;

class Neo4jRecommendationGraphStoreTest {

    private static Neo4j neo4j;
    private static Driver driver;
    private static Neo4jRecommendationGraphStore graphStore;
    private static Neo4jRecommendationEventProjectionStore projectionStore;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @BeforeAll
    static void setUpGraph() {
        neo4j = Neo4jBuilders.newInProcessBuilder().withDisabledServer().build();
        driver = GraphDatabase.driver(neo4j.boltURI(), AuthTokens.none());
        new RecommendationGraphSchemaInitializer(driver).afterPropertiesSet();
        graphStore = new Neo4jRecommendationGraphStore(driver);
        projectionStore = new Neo4jRecommendationEventProjectionStore(driver);

        try (Session session = driver.session()) {
            session.run("""
                CREATE (user:User {userId: 42}),
                       (drama:Genre {name: 'Drama'}),
                       (comedy:Genre {name: 'Comedy'}),
                       (seen:Movie {movieId: 1, title: 'Seen', active: true}),
                       (match:Movie {movieId: 2, title: 'Match', posterUrl: 'match.jpg', active: true}),
                       (other:Movie {movieId: 3, title: 'Other', active: true}),
                       (user)-[:WATCHED {orderId: 100}]->(seen),
                       (user)-[:RATED {reviewId: 200, rating: 5}]->(seen),
                       (:User {userId: 99})-[:WATCHED {orderId: 101}]->(match),
                       (:User {userId: 98})-[:RATED {reviewId: 201, rating: 4}]->(match),
                       (seen)-[:IN_GENRE]->(drama),
                       (match)-[:IN_GENRE]->(drama),
                       (other)-[:IN_GENRE]->(comedy)
                """).consume();
        }
    }

    @AfterAll
    static void tearDownGraph() {
        if (driver != null) {
            driver.close();
        }
        if (neo4j != null) {
            neo4j.close();
        }
    }

    @Test
    void personalizedQuery_excludesWatchedMoviesAndUsesPreferredGenres() {
        var recommendations = graphStore.findForUser(42, 10);

        assertThat(recommendations).extracting(item -> item.movieId()).containsExactly(2L);
        assertThat(recommendations.getFirst().matchedGenres()).containsExactly("Drama");
    }

    @Test
    void popularAndSimilarQueries_returnRankedGraphData() {
        assertThat(graphStore.findPopular(10)).extracting(item -> item.movieId()).contains(1L, 2L, 3L);
        assertThat(graphStore.findSimilar(1, 10)).extracting(item -> item.movieId()).containsExactly(2L);
    }

    @Test
    void tasteProfile_countsWatchedMoviesAndGenres() {
        UserTasteProfile profile = graphStore.findTasteProfile(42);

        assertThat(profile.watchedMovies()).isEqualTo(1);
        assertThat(profile.preferredGenres()).containsExactly("Drama");
    }

    @Test
    void eventProjection_isIdempotentAndBuildsRecommendationGraph() throws Exception {
        JsonNode movieEvent = event(
            "550e8400-e29b-41d4-a716-446655440010",
            "movie.created",
            "catalog-service",
            "2026-07-10T12:00:00Z",
            """
                {
                  "movieId": 50,
                  "title": "Projected movie",
                  "posterUrl": "projected.jpg",
                  "active": true,
                  "genreNames": ["Drama"]
                }
                """
        );
        JsonNode paidEvent = event(
            "550e8400-e29b-41d4-a716-446655440011",
            "order.paid",
            "booking-service",
            "2026-07-10T12:01:00Z",
            """
                {
                  "orderId": 500,
                  "userId": 500,
                  "showtimeId": 700,
                  "movieId": 50
                }
                """
        );

        assertThat(projectionStore.project(movieEvent)).isTrue();
        assertThat(projectionStore.project(movieEvent)).isFalse();
        assertThat(projectionStore.project(paidEvent)).isTrue();

        assertThat(graphStore.findTasteProfile(500).watchedMovies()).isEqualTo(1);
        assertThat(queryCount("MATCH (:User {userId: 500})-[:WATCHED]->(:Movie {movieId: 50}) RETURN count(*)"))
            .isEqualTo(1);
    }

    @Test
    void newerRefund_preventsOlderPaidEventFromRestoringWatch() throws Exception {
        JsonNode refund = event(
            "550e8400-e29b-41d4-a716-446655440012",
            "order.refunded",
            "booking-service",
            "2026-07-10T12:05:00Z",
            "{\"orderId\": 501}"
        );
        JsonNode olderPaid = event(
            "550e8400-e29b-41d4-a716-446655440013",
            "order.paid",
            "booking-service",
            "2026-07-10T12:04:00Z",
            """
                {
                  "orderId": 501,
                  "userId": 501,
                  "showtimeId": 701,
                  "movieId": 50
                }
                """
        );

        assertThat(projectionStore.project(refund)).isTrue();
        assertThat(projectionStore.project(olderPaid)).isTrue();

        assertThat(queryCount("MATCH ()-[watch:WATCHED {orderId: 501}]->() RETURN count(watch)"))
            .isZero();
    }

    @Test
    void newerHiddenReview_preventsOlderVisibleReviewFromRestoringRating() throws Exception {
        JsonNode hiddenReview = event(
            "550e8400-e29b-41d4-a716-446655440014",
            "review.created",
            "booking-service",
            "2026-07-10T12:07:00Z",
            """
                {
                  "reviewId": 502,
                  "userId": 502,
                  "movieId": 50,
                  "rating": 4,
                  "status": "HIDDEN"
                }
                """
        );
        JsonNode olderVisibleReview = event(
            "550e8400-e29b-41d4-a716-446655440015",
            "review.created",
            "booking-service",
            "2026-07-10T12:06:00Z",
            """
                {
                  "reviewId": 502,
                  "userId": 502,
                  "movieId": 50,
                  "rating": 4,
                  "status": "VISIBLE"
                }
                """
        );

        assertThat(projectionStore.project(hiddenReview)).isTrue();
        assertThat(projectionStore.project(olderVisibleReview)).isTrue();

        assertThat(queryCount("MATCH ()-[rated:RATED {reviewId: 502}]->() RETURN count(rated)"))
            .isZero();
    }

    private JsonNode event(
        String eventId,
        String eventType,
        String source,
        String occurredAt,
        String payload
    ) throws Exception {
        return OBJECT_MAPPER.readTree("""
            {
              "eventId": "%s",
              "eventType": "%s",
              "occurredAt": "%s",
              "schemaVersion": 1,
              "source": "%s",
              "payload": %s
            }
            """.formatted(eventId, eventType, occurredAt, source, payload));
    }

    private long queryCount(String query) {
        try (Session session = driver.session()) {
            return session.run(query).single().get(0).asLong();
        }
    }
}
