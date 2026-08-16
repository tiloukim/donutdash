-- Proof-of-pickup photo the driver takes at the shop (the bagged order), before
-- marking the order picked up. Mirrors delivery_photo_url (drop-off proof).
ALTER TABLE dd_deliveries ADD COLUMN IF NOT EXISTS pickup_photo_url TEXT;
