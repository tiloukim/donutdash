-- Pageview tracking for visitor analytics
CREATE TABLE IF NOT EXISTS dd_pageviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT, -- hashed IP for privacy
  country TEXT,
  region TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  shop_id UUID REFERENCES dd_shops(id),
  user_id UUID REFERENCES dd_users(id),
  session_id TEXT,
  device_type TEXT, -- mobile, desktop, tablet
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_pageviews_created_at ON dd_pageviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pageviews_path ON dd_pageviews(path);
CREATE INDEX IF NOT EXISTS idx_pageviews_shop_id ON dd_pageviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_pageviews_city ON dd_pageviews(city);
CREATE INDEX IF NOT EXISTS idx_pageviews_session ON dd_pageviews(session_id);
