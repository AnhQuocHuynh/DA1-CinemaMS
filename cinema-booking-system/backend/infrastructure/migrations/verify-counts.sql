\echo Counting known service tables that exist in the current database.

WITH service_tables(table_name) AS (
    VALUES
        ('genres'),
        ('movies'),
        ('movie_genres'),
        ('events'),
        ('cinemas'),
        ('rooms'),
        ('seat_types'),
        ('seat_templates'),
        ('showtimes'),
        ('showtime_seats'),
        ('vouchers'),
        ('orders'),
        ('tickets'),
        ('reviews')
)
SELECT format(
    'SELECT %L AS table_name, COUNT(*) AS row_count FROM public.%I;',
    table_name,
    table_name
)
FROM service_tables
WHERE to_regclass('public.' || table_name) IS NOT NULL
ORDER BY table_name
\gexec
