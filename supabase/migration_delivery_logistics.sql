-- Delivery Logistics System Migration
-- Run this in the Supabase SQL Editor

-- 1. Driver Locations table (real-time GPS tracking)
CREATE TABLE IF NOT EXISTS dd_driver_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES dd_users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  is_online BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id)
);

-- 2. Delivery Offers table (accept/decline with timer)
CREATE TABLE IF NOT EXISTS dd_delivery_offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id UUID NOT NULL REFERENCES dd_deliveries(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES dd_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Update dd_deliveries table - allow null driver_id and add new fields
ALTER TABLE dd_deliveries ALTER COLUMN driver_id DROP NOT NULL;
ALTER TABLE dd_deliveries ADD COLUMN IF NOT EXISTS base_pay DECIMAL(10,2) DEFAULT 3.00;
ALTER TABLE dd_deliveries ADD COLUMN IF NOT EXISTS bonus DECIMAL(10,2) DEFAULT 0;
ALTER TABLE dd_deliveries ADD COLUMN IF NOT EXISTS route_polyline TEXT;
ALTER TABLE dd_deliveries ADD COLUMN IF NOT EXISTS estimated_duration_min INTEGER;

-- Update status check constraint to include new statuses
ALTER TABLE dd_deliveries DROP CONSTRAINT IF EXISTS dd_deliveries_status_check;
-- If there's no constraint, that's fine. The status column is text.

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON dd_driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_online ON dd_driver_locations(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_delivery_offers_delivery ON dd_delivery_offers(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_driver ON dd_delivery_offers(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_pending ON dd_delivery_offers(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_deliveries_pending_unassigned ON dd_deliveries(status) WHERE status = 'pending' AND driver_id IS NULL;

-- 5. RLS Policies
ALTER TABLE dd_driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_delivery_offers ENABLE ROW LEVEL SECURITY;

-- Driver locations: drivers can update their own, anyone authenticated can read (for tracking)
CREATE POLICY "Drivers can manage own location" ON dd_driver_locations
  FOR ALL USING (driver_id IN (SELECT id FROM dd_users WHERE auth_id = auth.uid()));

CREATE POLICY "Authenticated users can view driver locations" ON dd_driver_locations
  FOR SELECT USING (auth.role() = 'authenticated');

-- Delivery offers: drivers can see/respond to their own
CREATE POLICY "Drivers can view own offers" ON dd_delivery_offers
  FOR SELECT USING (driver_id IN (SELECT id FROM dd_users WHERE auth_id = auth.uid()));

CREATE POLICY "Service role full access to offers" ON dd_delivery_offers
  FOR ALL USING (auth.role() = 'service_role');

-- 6. Enable Realtime for live tracking
ALTER PUBLICATION supabase_realtime ADD TABLE dd_driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE dd_delivery_offers;
ALTER PUBLICATION supabase_realtime ADD TABLE dd_deliveries;
