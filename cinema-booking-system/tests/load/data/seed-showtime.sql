-- ==============================================================================
-- SEED DATA FOR SHOWTIME LOAD TEST (idempotent)
-- ==============================================================================

\c cinema_showtime_db;

-- 1. Ensure test showtime (ID: 1) exists in cinema_showtime_db
INSERT INTO showtimes (id, base_price, created_at, start_time, end_time, room_id, movie_id, status)
VALUES (1, 75000.00, NOW(), NOW() + interval '1 day', NOW() + interval '1 day 2 hours', 1, 1, 'SCHEDULED')
ON CONFLICT (id) DO UPDATE 
SET status = 'SCHEDULED';

-- 2. Ensure 5 seats exist for showtime 1 (low count to force contention)
INSERT INTO showtime_seats (id, price, seat_template_id, showtime_id, status)
SELECT s, 75000.00, s, 1, 'AVAILABLE'
FROM generate_series(1, 5) s
ON CONFLICT (showtime_id, seat_template_id) DO UPDATE
SET status = 'AVAILABLE';
