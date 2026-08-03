CREATE DATABASE cinema_legacy_fixture;
CREATE DATABASE cinema_catalog_db;
CREATE DATABASE cinema_facility_db;
CREATE DATABASE cinema_showtime_db;
CREATE DATABASE cinema_booking_db;
CREATE DATABASE cinema_analytics_db;

\connect cinema_legacy_fixture

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE genres (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE movies (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    poster_url TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP
);

CREATE TABLE movie_genres (
    movie_id BIGINT NOT NULL REFERENCES movies(id),
    genre_id BIGINT NOT NULL REFERENCES genres(id),
    PRIMARY KEY (movie_id, genre_id)
);

CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    image_url TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP
);

CREATE TABLE cinemas (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE rooms (
    id BIGSERIAL PRIMARY KEY,
    cinema_id BIGINT NOT NULL REFERENCES cinemas(id),
    name VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE seat_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price_multiplier NUMERIC(8, 2) NOT NULL DEFAULT 1
);

CREATE TABLE seat_templates (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT NOT NULL REFERENCES rooms(id),
    seat_type_id BIGINT REFERENCES seat_types(id),
    row_label VARCHAR(5) NOT NULL,
    column_number INTEGER NOT NULL,
    column_span INTEGER NOT NULL DEFAULT 1,
    pathway BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE showtimes (
    id BIGSERIAL PRIMARY KEY,
    room_id BIGINT NOT NULL,
    movie_id BIGINT,
    event_id BIGINT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    base_price NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP
);

CREATE TABLE showtime_seats (
    id BIGSERIAL PRIMARY KEY,
    showtime_id BIGINT NOT NULL,
    seat_template_id BIGINT NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL
);

CREATE TABLE vouchers (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_type VARCHAR(20),
    discount_value NUMERIC(12, 2),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    showtime_id BIGINT NOT NULL,
    voucher_id BIGINT,
    seat_ids_snapshot TEXT,
    total_amount NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2),
    final_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(30) NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE tickets (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    showtime_seat_id BIGINT NOT NULL,
    ticket_code VARCHAR(100) NOT NULL UNIQUE,
    price NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP
);

CREATE TABLE reviews (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    movie_id BIGINT,
    event_id BIGINT,
    rating INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

INSERT INTO users (id, email, active) VALUES (1, 'rehearsal@cinema.local', TRUE);
INSERT INTO genres (id, name) VALUES (1, 'Rehearsal');
INSERT INTO movies (id, title, poster_url, active, updated_at)
VALUES (1, 'Migration Rehearsal Movie', '/rehearsal.jpg', TRUE, '2026-08-03 00:00:00');
INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 1);
INSERT INTO events (id, name, image_url, active, updated_at)
VALUES (1, 'Migration Rehearsal Event', '/event.jpg', TRUE, '2026-08-03 00:00:00');
INSERT INTO cinemas (id, name, active) VALUES (1, 'Rehearsal Cinema', TRUE);
INSERT INTO rooms (id, cinema_id, name, active) VALUES (1, 1, 'Room 1', TRUE);
INSERT INTO seat_types (id, name, price_multiplier) VALUES (1, 'STANDARD', 1);
INSERT INTO seat_templates
    (id, room_id, seat_type_id, row_label, column_number, column_span, pathway, active)
VALUES (1, 1, 1, 'A', 1, 1, FALSE, TRUE),
       (2, 1, NULL, 'A', 2, 1, TRUE, FALSE);
INSERT INTO showtimes
    (id, room_id, movie_id, event_id, start_time, end_time, base_price, status, created_at)
VALUES (1, 1, 1, NULL, '2026-08-04 10:00:00', '2026-08-04 12:00:00', 100000, 'SCHEDULED', '2026-08-03 00:00:00'),
       (2, 1, NULL, 1, '2026-08-04 13:00:00', '2026-08-04 15:00:00', 150000, 'SCHEDULED', '2026-08-03 00:00:00');
INSERT INTO showtime_seats (id, showtime_id, seat_template_id, price, status)
VALUES (1, 1, 1, 100000, 'BOOKED'),
       (2, 2, 1, 150000, 'AVAILABLE');
INSERT INTO vouchers (id, code, discount_type, discount_value, active)
VALUES (1, 'REHEARSAL', 'FIXED_AMOUNT', 10000, TRUE);
INSERT INTO orders
    (id, user_id, showtime_id, voucher_id, seat_ids_snapshot, total_amount, discount_amount, final_amount, status, created_at, updated_at)
VALUES (1, 1, 1, 1, '1', 100000, 10000, 90000, 'PAID', '2026-08-03 00:00:00', '2026-08-03 00:01:00');
INSERT INTO tickets (id, order_id, showtime_seat_id, ticket_code, price, status, created_at)
VALUES (1, 1, 1, 'REHEARSAL-TICKET', 90000, 'VALID', '2026-08-03 00:01:00');
INSERT INTO reviews (id, user_id, movie_id, event_id, rating, status, created_at, updated_at)
VALUES (1, 1, 1, NULL, 5, 'VISIBLE', '2026-08-03 00:02:00', '2026-08-03 00:02:00');
