package com.uit.cinema.recommendation.config;

import org.neo4j.driver.AuthTokens;
import org.neo4j.driver.Config;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
@ConditionalOnProperty(name = "recommendation.graph.enabled", havingValue = "true")
public class RecommendationGraphConfiguration {

    @Bean(destroyMethod = "close")
    Driver recommendationNeo4jDriver(
        @Value("${recommendation.graph.uri}") String uri,
        @Value("${recommendation.graph.username}") String username,
        @Value("${recommendation.graph.password}") String password,
        @Value("${recommendation.graph.max-connection-pool-size:20}") int maxConnectionPoolSize
    ) {
        Config config = Config.builder()
            .withMaxConnectionPoolSize(Math.max(1, Math.min(maxConnectionPoolSize, 100)))
            .withConnectionAcquisitionTimeout(10, TimeUnit.SECONDS)
            .withConnectionTimeout(5, TimeUnit.SECONDS)
            .build();
        Driver driver = GraphDatabase.driver(uri, AuthTokens.basic(username, password), config);
        driver.verifyConnectivity();
        return driver;
    }
}
