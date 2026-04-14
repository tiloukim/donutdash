-- Supply ordering system: DonutDash acts as middleman between suppliers and shops

-- Suppliers
CREATE TABLE IF NOT EXISTS dd_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Supply categories
CREATE TABLE IF NOT EXISTS dd_supply_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Supply products
CREATE TABLE IF NOT EXISTS dd_supply_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES dd_suppliers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES dd_supply_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL, -- e.g. '50lb bag', 'case of 12', 'gallon'
  sku TEXT,
  supplier_cost NUMERIC(10,2) NOT NULL,
  shop_price NUMERIC(10,2) NOT NULL,
  min_qty INT DEFAULT 1,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Supply orders placed by shops
CREATE TABLE IF NOT EXISTS dd_supply_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES dd_shops(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled')),
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  margin_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Supply order line items
CREATE TABLE IF NOT EXISTS dd_supply_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES dd_supply_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES dd_supply_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  supplier_cost NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_supply_orders_shop_id ON dd_supply_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_supply_products_supplier_id ON dd_supply_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supply_products_category_id ON dd_supply_products(category_id);
CREATE INDEX IF NOT EXISTS idx_supply_order_items_order_id ON dd_supply_order_items(order_id);

-- RLS
ALTER TABLE dd_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_supply_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_supply_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_supply_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd_supply_order_items ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (policies for anon/authenticated not needed since we use service client)
CREATE POLICY "Service role full access" ON dd_suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON dd_supply_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON dd_supply_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON dd_supply_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON dd_supply_order_items FOR ALL USING (true) WITH CHECK (true);

-- ============================
-- SEED DATA
-- ============================

-- Suppliers
INSERT INTO dd_suppliers (id, name, contact_name, email, phone, website, notes) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Dawn Foods', 'Sales Team', 'orders@dawnfoods.com', '(800) 292-1362', 'https://www.dawnfoods.com', 'Major bakery supplier, full line of mixes, icings, and fillings'),
  ('a1000000-0000-0000-0000-000000000002', 'BakeMark', 'Account Rep', 'info@bakemark.com', '(800) 421-0778', 'https://www.bakemark.com', 'Full-service bakery ingredients and supplies'),
  ('a1000000-0000-0000-0000-000000000003', 'Sunrise Supply', 'Customer Service', 'hello@sunrisesupply.com', '(903) 555-0100', NULL, 'Regional supplier for East Texas bakeries'),
  ('a1000000-0000-0000-0000-000000000004', 'Texas Bakery Supply', 'Orders Dept', 'orders@texasbakerysupply.com', '(214) 555-0200', 'https://texasbakerysupply.com', 'Texas-based bakery equipment and packaging')
ON CONFLICT DO NOTHING;

-- Categories
INSERT INTO dd_supply_categories (id, name, sort_order) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Flour & Mixes', 1),
  ('b1000000-0000-0000-0000-000000000002', 'Sugar & Sweeteners', 2),
  ('b1000000-0000-0000-0000-000000000003', 'Oils & Shortening', 3),
  ('b1000000-0000-0000-0000-000000000004', 'Glaze & Icing', 4),
  ('b1000000-0000-0000-0000-000000000005', 'Sprinkles & Toppings', 5),
  ('b1000000-0000-0000-0000-000000000006', 'Boxes & Packaging', 6),
  ('b1000000-0000-0000-0000-000000000007', 'Fillings & Cream', 7),
  ('b1000000-0000-0000-0000-000000000008', 'Yeast & Leavening', 8),
  ('b1000000-0000-0000-0000-000000000009', 'Equipment & Tools', 9)
ON CONFLICT DO NOTHING;

-- Products (supplier_cost = wholesale, shop_price = ~15-20% markup)
INSERT INTO dd_supply_products (supplier_id, category_id, name, description, unit, sku, supplier_cost, shop_price, min_qty) VALUES
  -- Flour & Mixes
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Dawn Donut Mix - Cake', 'Premium cake donut base mix, consistent results', '50lb bag', 'DWN-MIX-001', 28.50, 33.00, 1),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Dawn Donut Mix - Yeast Raised', 'Professional yeast-raised donut mix', '50lb bag', 'DWN-MIX-002', 31.00, 36.00, 1),
  ('a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'BakeMark All-Purpose Flour', 'High-quality all-purpose flour for baking', '50lb bag', 'BM-FLR-001', 18.50, 21.50, 1),
  ('a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'BakeMark Bread Flour', 'High-gluten bread flour for yeast donuts', '50lb bag', 'BM-FLR-002', 20.00, 23.50, 1),

  -- Sugar & Sweeteners
  ('a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002', 'Granulated Sugar', 'Fine granulated cane sugar', '50lb bag', 'SS-SUG-001', 22.00, 25.50, 1),
  ('a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000002', 'Powdered Sugar 10X', 'Confectioners powdered sugar for glazes and dusting', '50lb bag', 'SS-SUG-002', 24.00, 28.00, 1),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002', 'Dawn Cinnamon Sugar Blend', 'Pre-mixed cinnamon sugar for coating', '25lb bag', 'DWN-SUG-003', 19.00, 22.00, 1),

  -- Oils & Shortening
  ('a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 'Frying Shortening - Heavy Duty', 'High-stability frying shortening, extended fry life', '50lb cube', 'SS-OIL-001', 38.00, 44.00, 1),
  ('a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 'BakeMark Clear Fry Oil', 'Premium clear frying oil for donuts', '35lb jug', 'BM-OIL-001', 29.00, 34.00, 1),

  -- Glaze & Icing
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000004', 'Dawn Donut Glaze - Original', 'Classic white donut glaze, ready to use', '40lb pail', 'DWN-GLZ-001', 32.00, 37.00, 1),
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000004', 'Dawn Chocolate Icing', 'Rich chocolate icing for dipping and topping', '23lb pail', 'DWN-GLZ-002', 28.00, 32.50, 1),
  ('a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004', 'BakeMark Maple Glaze', 'Maple-flavored donut glaze', '23lb pail', 'BM-GLZ-001', 26.00, 30.00, 1),

  -- Sprinkles & Toppings
  ('a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 'Rainbow Jimmies Sprinkles', 'Classic rainbow jimmies sprinkle blend', '10lb bag', 'SS-TOP-001', 14.00, 16.50, 1),
  ('a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005', 'Coconut Flakes - Sweetened', 'Sweetened shredded coconut for topping', '10lb bag', 'SS-TOP-002', 12.50, 14.50, 1),

  -- Boxes & Packaging
  ('a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000006', 'Donut Box - Half Dozen', 'White windowed donut box, holds 6 donuts', 'case of 200', 'TX-BOX-001', 42.00, 49.00, 1),
  ('a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000006', 'Donut Box - Full Dozen', 'White windowed donut box, holds 12 donuts', 'case of 100', 'TX-BOX-002', 38.00, 44.00, 1),
  ('a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000006', 'Tissue Paper Sheets', 'Wax-coated tissue paper for donut handling', 'case of 1000', 'TX-BOX-003', 15.00, 17.50, 1),

  -- Fillings & Cream
  ('a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000007', 'Dawn Bavarian Cream Filling', 'Smooth bavarian cream donut filling', '35lb pail', 'DWN-FIL-001', 35.00, 40.50, 1),
  ('a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000007', 'BakeMark Raspberry Filling', 'Seedless raspberry filling for filled donuts', '20lb pail', 'BM-FIL-001', 22.00, 25.50, 1),

  -- Yeast & Leavening
  ('a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000008', 'Instant Dry Yeast', 'Professional-grade instant dry yeast', '1lb vacuum pack', 'SS-YST-001', 5.50, 6.50, 2),
  ('a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000008', 'Baking Powder - Double Acting', 'Double-acting baking powder for cake donuts', '5lb can', 'SS-YST-002', 8.00, 9.50, 1)
ON CONFLICT DO NOTHING;
