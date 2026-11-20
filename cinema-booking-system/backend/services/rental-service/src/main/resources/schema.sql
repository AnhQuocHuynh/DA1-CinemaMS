CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE room_rentals ADD COLUMN IF NOT EXISTS refund_amount numeric(12, 2);
ALTER TABLE room_rentals ADD COLUMN IF NOT EXISTS refund_status varchar(20);
UPDATE room_rentals SET refund_status = 'NONE' WHERE refund_status IS NULL;
ALTER TABLE room_rentals ALTER COLUMN refund_status SET DEFAULT 'NONE';
ALTER TABLE room_rentals ALTER COLUMN refund_status SET NOT NULL;

ALTER TABLE room_rentals DROP CONSTRAINT IF EXISTS room_rentals_no_overlap;

ALTER TABLE room_rentals
    ADD CONSTRAINT room_rentals_no_overlap
    EXCLUDE USING gist (
        room_id WITH =,
        tsrange(start_time, end_time + interval '15 minutes') WITH &&
    )
    WHERE (status IN ('PENDING_APPROVAL', 'AWAITING_PAYMENT', 'CONFIRMED'));
