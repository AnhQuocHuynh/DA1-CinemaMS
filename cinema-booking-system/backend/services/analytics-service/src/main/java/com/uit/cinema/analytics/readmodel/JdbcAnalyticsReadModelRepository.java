package com.uit.cinema.analytics.readmodel;

import com.uit.cinema.analytics.dto.LiveSaleResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Repository
@ConditionalOnProperty(name = "analytics.read-model.enabled", havingValue = "true")
public class JdbcAnalyticsReadModelRepository implements AnalyticsReadModelRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcAnalyticsReadModelRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public DashboardMetric dashboardMetric(LocalDateTime from, LocalDateTime to) {
        OrderMetric orders = paidOrderMetric(from, to);
        SeatMetric seats = seatMetric(from, to);
        return new DashboardMetric(
            orders.revenue(),
            orders.orders(),
            seats.sold(),
            seats.available(),
            count("SELECT COUNT(*) FROM analytics_users WHERE active = TRUE"),
            count("SELECT COUNT(*) FROM analytics_contents WHERE content_type = 'MOVIE' AND active = TRUE")
        );
    }

    @Override
    public Map<LocalDate, RevenueMetric> revenueByDay(LocalDateTime from, LocalDateTime to) {
        String sql = """
            SELECT CAST(COALESCE(updated_at, created_at) AS DATE) AS revenue_day,
                   COALESCE(SUM(final_amount), 0) AS revenue,
                   COUNT(*) AS orders,
                   COALESCE(SUM(seat_count), 0) AS tickets
            FROM analytics_orders
            WHERE status = 'PAID'
              AND COALESCE(updated_at, created_at) >= ?
              AND COALESCE(updated_at, created_at) < ?
            GROUP BY CAST(COALESCE(updated_at, created_at) AS DATE)
            ORDER BY revenue_day
            """;
        Map<LocalDate, RevenueMetric> result = new LinkedHashMap<>();
        List<RevenueDayRow> rows = jdbcTemplate.query(
            sql,
            (rs, rowNum) -> new RevenueDayRow(
                rs.getDate("revenue_day").toLocalDate(),
                new RevenueMetric(rs.getBigDecimal("revenue"), rs.getLong("orders"), rs.getLong("tickets"))
            ),
            Timestamp.valueOf(from),
            Timestamp.valueOf(to)
        );
        rows.forEach(row -> result.put(row.day(), row.metric()));
        return result;
    }

    @Override
    public List<LiveSaleResponse> liveSales(int limit) {
        String sql = """
            SELECT o.order_id,
                   COALESCE(content.title, 'Unknown showtime') AS title,
                   COALESCE(room.name, 'Unknown room') AS room_name,
                   o.seat_count,
                   COALESCE(o.final_amount, 0) AS amount,
                   content.poster_url
            FROM analytics_orders o
            LEFT JOIN analytics_showtimes showtime ON showtime.showtime_id = o.showtime_id
            LEFT JOIN analytics_contents content
                   ON (content.content_type = 'MOVIE' AND content.content_id = showtime.movie_id)
                   OR (content.content_type = 'EVENT' AND content.content_id = showtime.event_id)
            LEFT JOIN analytics_rooms room ON room.room_id = showtime.room_id
            WHERE o.status = 'PAID'
            ORDER BY COALESCE(o.updated_at, o.created_at) DESC
            LIMIT ?
            """;
        return jdbcTemplate.query(
            sql,
            (rs, rowNum) -> new LiveSaleResponse(
                "order-" + rs.getLong("order_id"),
                rs.getString("title"),
                rs.getString("room_name"),
                rs.getInt("seat_count"),
                rs.getBigDecimal("amount"),
                rs.getString("poster_url")
            ),
            limit
        );
    }

    @Override
    public List<PopularMovieMetric> popularMovies(LocalDateTime from, LocalDateTime to, int limit) {
        String sql = """
            SELECT CAST(showtime.movie_id AS VARCHAR) AS movie_id,
                   COALESCE(content.title, CONCAT('Movie #', CAST(showtime.movie_id AS VARCHAR))) AS title,
                   COALESCE(SUM(o.seat_count), 0) AS tickets_sold,
                   COALESCE(SUM(o.final_amount), 0) AS revenue
            FROM analytics_orders o
            JOIN analytics_showtimes showtime ON showtime.showtime_id = o.showtime_id
            LEFT JOIN analytics_contents content
                   ON content.content_type = 'MOVIE' AND content.content_id = showtime.movie_id
            WHERE o.status = 'PAID'
              AND showtime.movie_id IS NOT NULL
              AND COALESCE(o.updated_at, o.created_at) >= ?
              AND COALESCE(o.updated_at, o.created_at) < ?
            GROUP BY showtime.movie_id, content.title
            ORDER BY tickets_sold DESC
            LIMIT ?
            """;
        return jdbcTemplate.query(
            sql,
            ps -> {
                ps.setTimestamp(1, Timestamp.valueOf(from));
                ps.setTimestamp(2, Timestamp.valueOf(to));
                ps.setInt(3, limit);
            },
            (rs, rowNum) -> new PopularMovieMetric(
                rs.getString("movie_id"),
                rs.getString("title"),
                rs.getLong("tickets_sold"),
                rs.getBigDecimal("revenue")
            )
        );
    }

    private OrderMetric paidOrderMetric(LocalDateTime from, LocalDateTime to) {
        String sql = """
            SELECT COALESCE(SUM(final_amount), 0) AS revenue,
                   COUNT(*) AS orders
            FROM analytics_orders
            WHERE status = 'PAID'
              AND COALESCE(updated_at, created_at) >= ?
              AND COALESCE(updated_at, created_at) < ?
            """;
        return jdbcTemplate.queryForObject(
            sql,
            (rs, rowNum) -> new OrderMetric(rs.getBigDecimal("revenue"), rs.getLong("orders")),
            Timestamp.valueOf(from),
            Timestamp.valueOf(to)
        );
    }

    private SeatMetric seatMetric(LocalDateTime from, LocalDateTime to) {
        String sql = """
            SELECT COALESCE(SUM(CASE WHEN seat.status = 'BOOKED' THEN 1 ELSE 0 END), 0) AS sold,
                   COALESCE(SUM(CASE WHEN seat.status = 'AVAILABLE' THEN 1 ELSE 0 END), 0) AS available
            FROM analytics_showtime_seats seat
            JOIN analytics_showtimes showtime ON showtime.showtime_id = seat.showtime_id
            WHERE showtime.status <> 'CANCELLED'
              AND showtime.start_time >= ?
              AND showtime.start_time < ?
            """;
        return jdbcTemplate.queryForObject(
            sql,
            (rs, rowNum) -> new SeatMetric(rs.getLong("sold"), rs.getLong("available")),
            Timestamp.valueOf(from),
            Timestamp.valueOf(to)
        );
    }

    private long count(String sql) {
        Long value = jdbcTemplate.queryForObject(sql, Long.class);
        return value != null ? value : 0L;
    }

    private record OrderMetric(BigDecimal revenue, long orders) {
    }

    private record SeatMetric(long sold, long available) {
    }

    private record RevenueDayRow(LocalDate day, RevenueMetric metric) {
    }
}
