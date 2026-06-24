-- Manual patch for existing PostgreSQL databases.
-- Hibernate ddl-auto=update creates new columns, but may not always relax NOT NULL constraints.

ALTER TABLE showtimes ALTER COLUMN movie_id DROP NOT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sales_channel VARCHAR(20) DEFAULT 'ONLINE';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by_staff_id BIGINT;
