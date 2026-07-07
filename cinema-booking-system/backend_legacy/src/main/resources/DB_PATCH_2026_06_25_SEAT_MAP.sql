ALTER TABLE seat_templates
    ADD COLUMN IF NOT EXISTS pathway BOOLEAN DEFAULT FALSE;

UPDATE seat_templates
SET pathway = FALSE
WHERE pathway IS NULL;

ALTER TABLE seat_templates
    ALTER COLUMN pathway SET NOT NULL;
