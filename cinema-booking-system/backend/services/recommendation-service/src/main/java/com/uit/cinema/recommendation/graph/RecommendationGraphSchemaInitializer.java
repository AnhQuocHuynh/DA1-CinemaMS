package com.uit.cinema.recommendation.graph;

import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@ConditionalOnProperty(name = "recommendation.graph.enabled", havingValue = "true")
public class RecommendationGraphSchemaInitializer implements InitializingBean {

    private static final List<String> CONSTRAINTS = List.of(
        "CREATE CONSTRAINT recommendation_event_id IF NOT EXISTS FOR (event:ProcessedEvent) REQUIRE event.eventId IS UNIQUE",
        "CREATE CONSTRAINT recommendation_user_id IF NOT EXISTS FOR (user:User) REQUIRE user.userId IS UNIQUE",
        "CREATE CONSTRAINT recommendation_movie_id IF NOT EXISTS FOR (movie:Movie) REQUIRE movie.movieId IS UNIQUE",
        "CREATE CONSTRAINT recommendation_genre_name IF NOT EXISTS FOR (genre:Genre) REQUIRE genre.name IS UNIQUE"
    );

    private final Driver driver;

    public RecommendationGraphSchemaInitializer(Driver driver) {
        this.driver = driver;
    }

    @Override
    public void afterPropertiesSet() {
        try (Session session = driver.session()) {
            session.executeWriteWithoutResult(transaction ->
                CONSTRAINTS.forEach(statement -> transaction.run(statement).consume())
            );
        }
    }
}
