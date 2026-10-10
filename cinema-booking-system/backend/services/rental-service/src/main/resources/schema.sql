CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
    IF to_regclass('public.room_rentals') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'room_rentals_no_overlap') THEN
        ALTER TABLE room_rentals
            ADD CONSTRAINT room_rentals_no_overlap
            EXCLUDE USING gist (
                room_id WITH =,
                tsrange(start_time, end_time) WITH &&
            )
            WHERE (status IN ('PENDING_APPROVAL', 'AWAITING_PAYMENT', 'CONFIRMED'));
    END IF;
END $$;
