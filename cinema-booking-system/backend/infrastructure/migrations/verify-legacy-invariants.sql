DO $$
DECLARE
    violations BIGINT;
BEGIN
    SELECT COUNT(*) INTO violations
    FROM movie_genres link
    LEFT JOIN movies movie ON movie.id = link.movie_id
    LEFT JOIN genres genre ON genre.id = link.genre_id
    WHERE movie.id IS NULL OR genre.id IS NULL;
    IF violations > 0 THEN
        RAISE EXCEPTION 'movie_genres contains % orphan rows', violations;
    END IF;

    SELECT COUNT(*) INTO violations
    FROM rooms room
    LEFT JOIN cinemas cinema ON cinema.id = room.cinema_id
    WHERE cinema.id IS NULL;
    IF violations > 0 THEN
        RAISE EXCEPTION 'rooms contains % rows with missing cinema', violations;
    END IF;

    SELECT COUNT(*) INTO violations
    FROM seat_templates seat
    LEFT JOIN rooms room ON room.id = seat.room_id
    LEFT JOIN seat_types seat_type ON seat_type.id = seat.seat_type_id
    WHERE room.id IS NULL
       OR (seat.seat_type_id IS NOT NULL AND seat_type.id IS NULL);
    IF violations > 0 THEN
        RAISE EXCEPTION 'seat_templates contains % invalid room/seat-type references', violations;
    END IF;

    SELECT COUNT(*) INTO violations
    FROM showtimes showtime
    LEFT JOIN rooms room ON room.id = showtime.room_id
    LEFT JOIN movies movie ON movie.id = showtime.movie_id
    LEFT JOIN events event ON event.id = showtime.event_id
    WHERE room.id IS NULL
       OR (showtime.movie_id IS NULL AND showtime.event_id IS NULL)
       OR (showtime.movie_id IS NOT NULL AND showtime.event_id IS NOT NULL)
       OR (showtime.movie_id IS NOT NULL AND movie.id IS NULL)
       OR (showtime.event_id IS NOT NULL AND event.id IS NULL);
    IF violations > 0 THEN
        RAISE EXCEPTION 'showtimes contains % invalid content/room references', violations;
    END IF;

    SELECT COUNT(*) INTO violations
    FROM showtime_seats seat
    LEFT JOIN showtimes showtime ON showtime.id = seat.showtime_id
    LEFT JOIN seat_templates template ON template.id = seat.seat_template_id
    WHERE showtime.id IS NULL OR template.id IS NULL;
    IF violations > 0 THEN
        RAISE EXCEPTION 'showtime_seats contains % invalid showtime/template references', violations;
    END IF;

    SELECT COUNT(*) INTO violations
    FROM orders customer_order
    LEFT JOIN users customer ON customer.id = customer_order.user_id
    LEFT JOIN showtimes showtime ON showtime.id = customer_order.showtime_id
    LEFT JOIN vouchers voucher ON voucher.id = customer_order.voucher_id
    WHERE customer.id IS NULL
       OR showtime.id IS NULL
       OR (customer_order.voucher_id IS NOT NULL AND voucher.id IS NULL);
    IF violations > 0 THEN
        RAISE EXCEPTION 'orders contains % invalid user/showtime/voucher references', violations;
    END IF;

    SELECT COUNT(*) INTO violations
    FROM tickets ticket
    LEFT JOIN orders customer_order ON customer_order.id = ticket.order_id
    LEFT JOIN showtime_seats seat ON seat.id = ticket.showtime_seat_id
    WHERE customer_order.id IS NULL OR seat.id IS NULL;
    IF violations > 0 THEN
        RAISE EXCEPTION 'tickets contains % invalid order/showtime-seat references', violations;
    END IF;

    SELECT COUNT(*) INTO violations
    FROM reviews review
    LEFT JOIN users customer ON customer.id = review.user_id
    LEFT JOIN movies movie ON movie.id = review.movie_id
    LEFT JOIN events event ON event.id = review.event_id
    WHERE customer.id IS NULL
       OR (review.movie_id IS NULL AND review.event_id IS NULL)
       OR (review.movie_id IS NOT NULL AND review.event_id IS NOT NULL)
       OR (review.movie_id IS NOT NULL AND movie.id IS NULL)
       OR (review.event_id IS NOT NULL AND event.id IS NULL)
       OR review.rating NOT BETWEEN 1 AND 5;
    IF violations > 0 THEN
        RAISE EXCEPTION 'reviews contains % invalid target/user/rating rows', violations;
    END IF;
END
$$;

SELECT 'legacy invariants verified' AS result;
