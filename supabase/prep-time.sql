-- Add prep time (in minutes) to menu items
ALTER TABLE dd_menu_items ADD COLUMN IF NOT EXISTS prep_time_min INTEGER DEFAULT NULL;
