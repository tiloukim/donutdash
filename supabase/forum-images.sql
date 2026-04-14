-- Add images column to forum posts (stores array of image URLs as JSON)
ALTER TABLE dd_forum_posts ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';
