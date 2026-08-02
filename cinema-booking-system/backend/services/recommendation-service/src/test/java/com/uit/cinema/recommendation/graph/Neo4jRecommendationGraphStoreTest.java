package com.uit.cinema.recommendation.graph;

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

    @BeforeAll
    static void setUpGraph() {
        neo4j = Neo4jBuilders.newInProcessBuilder().withDisabledServer().build();
        driver = GraphDatabase.driver(neo4j.boltURI(), AuthTokens.none());
        new RecommendationGraphSchemaInitializer(driver).afterPropertiesSet();
        graphStore = new Neo4jRecommendationGraphStore(driver);

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
}
