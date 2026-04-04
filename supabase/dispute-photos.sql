-- Add photo_urls array column to dd_disputes for multiple evidence photos
ALTER TABLE dd_disputes ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT NULL;
