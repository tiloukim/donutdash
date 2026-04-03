-- Add delivery photo URL column to dd_deliveries
ALTER TABLE dd_deliveries ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT;
