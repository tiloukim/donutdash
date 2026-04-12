-- Add columns for order adjustments and refunds
ALTER TABLE dd_orders ADD COLUMN IF NOT EXISTS original_total decimal(10,2) DEFAULT null;
ALTER TABLE dd_orders ADD COLUMN IF NOT EXISTS refund_amount decimal(10,2) DEFAULT null;
