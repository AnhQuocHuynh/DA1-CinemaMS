package com.uit.cinema.recommendation.graph;

import org.neo4j.driver.Driver;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component("recommendationGraph")
@ConditionalOnProperty(name = "recommendation.graph.enabled", havingValue = "true")
public class RecommendationGraphHealthIndicator implements HealthIndicator {

    private final Driver driver;

    public RecommendationGraphHealthIndicator(Driver driver) {
        this.driver = driver;
    }

    @Override
    public Health health() {
        try {
            driver.verifyConnectivity();
            return Health.up().withDetail("database", "neo4j").build();
        } catch (RuntimeException exception) {
            return Health.down(exception).withDetail("database", "neo4j").build();
        }
    }
}
