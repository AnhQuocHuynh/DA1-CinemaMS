CREATE TABLE IF NOT EXISTS analytics_orders (
    order_id BIGINT PRIMARY KEY,
    user_id BIGINT,
    showtime_id BIGINT,
    status VARCHAR(30) NOT NULL,
    final_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    seat_ids_snapshot TEXT,
    seat_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_showtimes (
    showtime_id BIGINT PRIMARY KEY,
    movie_id BIGINT,
    event_id BIGINT,
    room_id BIGINT,
    start_time TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_showtime_seats (
    seat_id BIGINT PRIMARY KEY,
    showtime_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_contents (
    content_type VARCHAR(16) NOT NULL,
    content_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    poster_url TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP,
    PRIMARY KEY (content_type, content_id)
);

ALTER TABLE analytics_contents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS analytics_processed_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_rooms (
    room_id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_users (
    user_id BIGINT PRIMARY KEY,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_analytics_orders_status_time
    ON analytics_orders (status, updated_at, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_orders_showtime
    ON analytics_orders (showtime_id);

CREATE INDEX IF NOT EXISTS idx_analytics_showtimes_start
    ON analytics_showtimes (start_time);

CREATE INDEX IF NOT EXISTS idx_analytics_showtime_seats_showtime
    ON analytics_showtime_seats (showtime_id);
