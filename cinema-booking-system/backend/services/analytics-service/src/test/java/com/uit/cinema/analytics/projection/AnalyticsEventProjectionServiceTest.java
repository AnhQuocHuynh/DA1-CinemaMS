package com.uit.cinema.analytics.projection;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
    "analytics.read-model.enabled=true",
    "spring.datasource.url=jdbc:h2:mem:analytics-event-projection;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.sql.init.mode=always"
})
class AnalyticsEventProjectionServiceTest {

    @Autowired
    private AnalyticsEventProjectionService projectionService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("DELETE FROM analytics_processed_events");
        jdbcTemplate.update("DELETE FROM analytics_orders");
        jdbcTemplate.update("DELETE FROM analytics_contents");
    }

    @Test
    void paidOrder_isProjectedOnce() throws Exception {
        JsonNode event = objectMapper.readTree("""
            {
              "eventId": "550e8400-e29b-41d4-a716-446655440000",
              "eventType": "order.paid",
              "occurredAt": "2026-07-10T12:00:00Z",
              "schemaVersion": 1,
              "source": "booking-service",
              "payload": {
                "orderId": 1234,
                "userId": 42,
                "showtimeId": 567,
                "finalAmount": 405000.00,
                "ticketCount": 3
              }
            }
            """);

        assertThat(projectionService.project(event)).isTrue();
        assertThat(projectionService.project(event)).isFalse();

        assertThat(jdbcTemplate.queryForObject(
            "SELECT status FROM analytics_orders WHERE order_id = 1234", String.class
        )).isEqualTo("PAID");
        assertThat(jdbcTemplate.queryForObject(
            "SELECT final_amount FROM analytics_orders WHERE order_id = 1234", BigDecimal.class
        )).isEqualByComparingTo("405000.00");
        assertThat(jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM analytics_processed_events", Integer.class
        )).isEqualTo(1);
    }

    @Test
    void latestMovieEvent_winsOverOutOfOrderDelivery() throws Exception {
        JsonNode newerEvent = movieEvent(
            "550e8400-e29b-41d4-a716-446655440001",
            "movie.updated",
            "2026-07-10T12:00:01Z",
            "New title",
            true
        );
        JsonNode olderEvent = movieEvent(
            "550e8400-e29b-41d4-a716-446655440002",
            "movie.deleted",
            "2026-07-10T12:00:00Z",
            "Old title",
            false
        );

        assertThat(projectionService.project(newerEvent)).isTrue();
        assertThat(projectionService.project(olderEvent)).isTrue();

        assertThat(jdbcTemplate.queryForObject(
            "SELECT title FROM analytics_contents WHERE content_type = 'MOVIE' AND content_id = 15", String.class
        )).isEqualTo("New title");
        assertThat(jdbcTemplate.queryForObject(
            "SELECT active FROM analytics_contents WHERE content_type = 'MOVIE' AND content_id = 15", Boolean.class
        )).isTrue();
    }

    private JsonNode movieEvent(String eventId, String eventType, String occurredAt, String title, boolean active) throws Exception {
        return objectMapper.readTree("""
            {
              "eventId": "%s",
              "eventType": "%s",
              "occurredAt": "%s",
              "schemaVersion": 1,
              "source": "catalog-service",
              "payload": {
                "movieId": 15,
                "title": "%s",
                "posterUrl": "poster.jpg",
                "active": %s
              }
            }
            """.formatted(eventId, eventType, occurredAt, title, active));
    }
}

