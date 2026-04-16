-- Google Places reviews pulled for each shop. Separate from dd_reviews so
-- we don't need a fake dd_orders row per Google review.
CREATE TABLE IF NOT EXISTS dd_google_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES dd_shops(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_url TEXT,
  profile_photo_url TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  relative_time TEXT,         -- e.g. "2 weeks ago" as Google renders it
  google_time BIGINT,         -- epoch seconds from Google
  language TEXT,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  -- Dedup on (shop, author_name, google_time) since Google has no stable review id
  UNIQUE (shop_id, author_name, google_time)
);

CREATE INDEX IF NOT EXISTS idx_google_reviews_shop ON dd_google_reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_google_reviews_time ON dd_google_reviews(google_time DESC);

ALTER TABLE dd_google_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read google_reviews" ON dd_google_reviews
  FOR SELECT USING (true);

CREATE POLICY "Service role full access google_reviews" ON dd_google_reviews
  FOR ALL USING (auth.role() = 'service_role');
