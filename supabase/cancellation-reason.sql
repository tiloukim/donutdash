-- Add cancellation_reason column to dd_orders
-- Stores why a shop rejected/cancelled an order
ALTER TABLE dd_orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
