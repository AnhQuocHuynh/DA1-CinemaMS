package com.uit.cinema.analytics.readmodel;

import com.uit.cinema.analytics.dto.LiveSaleResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
    "analytics.read-model.enabled=true",
    "spring.datasource.url=jdbc:h2:mem:analytics-read-model;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.sql.init.mode=always"
})
class JdbcAnalyticsReadModelRepositoryTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private AnalyticsReadModelRepository repository;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("DELETE FROM analytics_orders");
        jdbcTemplate.update("DELETE FROM analytics_showtime_seats");
        jdbcTemplate.update("DELETE FROM analytics_showtimes");
        jdbcTemplate.update("DELETE FROM analytics_contents");
        jdbcTemplate.update("DELETE FROM analytics_rooms");
        jdbcTemplate.update("DELETE FROM analytics_users");

        jdbcTemplate.update("""
            INSERT INTO analytics_users (user_id, active)
            VALUES (10, TRUE), (11, FALSE)
            """);
        jdbcTemplate.update("""
            INSERT INTO analytics_rooms (room_id, name)
            VALUES (3, 'Room A')
            """);
        jdbcTemplate.update("""
            INSERT INTO analytics_contents (content_type, content_id, title, poster_url, active)
            VALUES ('MOVIE', 5, 'Test Movie', 'poster.jpg', TRUE)
            """);
        jdbcTemplate.update("""
            INSERT INTO analytics_showtimes (showtime_id, movie_id, event_id, room_id, start_time, status)
            VALUES (7, 5, NULL, 3, ?, 'SCHEDULED')
            """, LocalDateTime.of(2026, 7, 2, 10, 0));
        jdbcTemplate.update("""
            INSERT INTO analytics_showtime_seats (seat_id, showtime_id, status)
            VALUES (101, 7, 'BOOKED'), (102, 7, 'AVAILABLE')
            """);
        jdbcTemplate.update("""
            INSERT INTO analytics_orders
                (order_id, user_id, showtime_id, status, final_amount, seat_ids_snapshot, seat_count, created_at, updated_at)
            VALUES
                (99, 10, 7, 'PAID', 150000.00, '101,102', 2, ?, ?)
            """, LocalDateTime.of(2026, 7, 2, 9, 0), LocalDateTime.of(2026, 7, 2, 9, 5));
    }

    @Test
    void dashboardMetricAggregatesReadModelTables() {
        DashboardMetric metric = repository.dashboardMetric(
            LocalDateTime.of(2026, 7, 1, 0, 0),
            LocalDateTime.of(2026, 7, 4, 0, 0)
        );

        assertThat(metric.totalRevenue()).isEqualByComparingTo(new BigDecimal("150000.00"));
        assertThat(metric.totalBookings()).isEqualTo(1);
        assertThat(metric.seatsSold()).isEqualTo(1);
        assertThat(metric.seatsAvailable()).isEqualTo(1);
        assertThat(metric.activeUsers()).isEqualTo(1);
        assertThat(metric.totalMovies()).isEqualTo(1);
    }

    @Test
    void revenueAndListsUsePaidOrders() {
        Map<LocalDate, RevenueMetric> revenueByDay = repository.revenueByDay(
            LocalDateTime.of(2026, 7, 1, 0, 0),
            LocalDateTime.of(2026, 7, 4, 0, 0)
        );
        List<LiveSaleResponse> liveSales = repository.liveSales(5);
        List<PopularMovieMetric> popularMovies = repository.popularMovies(
            LocalDateTime.of(2026, 7, 1, 0, 0),
            LocalDateTime.of(2026, 7, 4, 0, 0),
            5
        );

        assertThat(revenueByDay.get(LocalDate.of(2026, 7, 2)).revenue())
            .isEqualByComparingTo(new BigDecimal("150000.00"));
        assertThat(liveSales)
            .singleElement()
            .extracting(LiveSaleResponse::movieTitle, LiveSaleResponse::screen, LiveSaleResponse::tickets)
            .containsExactly("Test Movie", "Room A", 2);
        assertThat(popularMovies)
            .singleElement()
            .satisfies(movie -> {
                assertThat(movie.id()).isEqualTo("5");
                assertThat(movie.ticketsSold()).isEqualTo(2);
            });
    }
}
