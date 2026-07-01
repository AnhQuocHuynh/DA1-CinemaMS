-- Manual patch for existing PostgreSQL databases after seat-map contract updates.
-- Adds backend signal for FE pathway cells in room/showtime seat maps.

ALTER TABLE seat_templates
    ADD COLUMN IF NOT EXISTS pathway BOOLEAN DEFAULT FALSE;

UPDATE seat_templates
SET pathway = FALSE
WHERE pathway IS NULL;

ALTER TABLE seat_templates
    ALTER COLUMN pathway SET NOT NULL;
