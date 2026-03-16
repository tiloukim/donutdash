-- DonutDash Seed Data
-- Run this after schema.sql

-- ============================================================
-- SHOP OWNER USER
-- Note: auth_id will need to be updated to match a real Supabase
-- auth user. Use a placeholder UUID for now.
-- ============================================================
insert into dd_users (id, auth_id, email, name, phone, role)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'owner@topdonuts.com',
  'Tony Kim',
  '(213) 555-0100',
  'shop_owner'
);

-- ============================================================
-- TOP DONUTS SHOP
-- ============================================================
insert into dd_shops (
  id, owner_id, name, slug, description, image_url, banner_url,
  address, city, state, zip, lat, lng, phone,
  rating, review_count, delivery_fee, min_order, service_fee_pct
)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Top Donuts',
  'top-donuts',
  'Fresh donuts made daily since 1985. LA''s favorite neighborhood donut shop serving classic glazed, specialty donuts, hot coffee, and breakfast items.',
  '/images/shops/top-donuts.jpg',
  '/images/shops/top-donuts-banner.jpg',
  '123 Main St',
  'Los Angeles',
  'CA',
  '90012',
  34.0522,
  -118.2437,
  '(213) 555-0123',
  4.6,
  128,
  3.99,
  10,
  15
);

-- ============================================================
-- BUSINESS HOURS (Mon-Sun, 5am-6pm, closed never)
-- ============================================================
insert into dd_business_hours (shop_id, day_of_week, open_time, close_time, is_closed)
values
  ('22222222-2222-2222-2222-222222222222', 0, '05:00', '18:00', false),
  ('22222222-2222-2222-2222-222222222222', 1, '05:00', '18:00', false),
  ('22222222-2222-2222-2222-222222222222', 2, '05:00', '18:00', false),
  ('22222222-2222-2222-2222-222222222222', 3, '05:00', '18:00', false),
  ('22222222-2222-2222-2222-222222222222', 4, '05:00', '18:00', false),
  ('22222222-2222-2222-2222-222222222222', 5, '06:00', '19:00', false),
  ('22222222-2222-2222-2222-222222222222', 6, '06:00', '19:00', false);

-- ============================================================
-- MENU ITEMS: DONUTS
-- ============================================================
insert into dd_menu_items (shop_id, name, description, price, category, is_available, is_featured, sort_order)
values
  ('22222222-2222-2222-2222-222222222222', 'Glazed', 'Our classic ring donut with a sweet glaze. Light, fluffy, and irresistible.', 1.50, 'donuts', true, true, 1),
  ('22222222-2222-2222-2222-222222222222', 'Chocolate Frosted', 'Rich chocolate frosting on a soft raised donut.', 2.00, 'donuts', true, true, 2),
  ('22222222-2222-2222-2222-222222222222', 'Strawberry Sprinkle', 'Strawberry frosted donut topped with rainbow sprinkles.', 2.00, 'donuts', true, false, 3),
  ('22222222-2222-2222-2222-222222222222', 'Boston Cream', 'Custard-filled donut topped with rich chocolate ganache.', 2.50, 'donuts', true, true, 4),
  ('22222222-2222-2222-2222-222222222222', 'Maple Bar', 'Long bar donut with sweet maple glaze.', 2.00, 'donuts', true, false, 5),
  ('22222222-2222-2222-2222-222222222222', 'Apple Fritter', 'Crispy fried dough with chunks of real apple and cinnamon glaze.', 2.50, 'donuts', true, true, 6),
  ('22222222-2222-2222-2222-222222222222', 'Old Fashioned', 'Dense, craggy cake donut with a sweet glaze. A true classic.', 1.75, 'donuts', true, false, 7),
  ('22222222-2222-2222-2222-222222222222', 'Jelly Filled', 'Soft donut filled with sweet strawberry jelly, dusted with powdered sugar.', 2.00, 'donuts', true, false, 8),
  ('22222222-2222-2222-2222-222222222222', 'Cinnamon Sugar', 'Warm cake donut rolled in cinnamon sugar. Simple and delicious.', 1.75, 'donuts', true, false, 9),
  ('22222222-2222-2222-2222-222222222222', 'Donut Holes 6-pack', 'Six bite-sized glazed donut holes. Perfect for sharing.', 3.50, 'donuts', true, false, 10),
  ('22222222-2222-2222-2222-222222222222', 'Half Dozen Glazed', 'Six of our famous glazed donuts at a great value.', 6.99, 'donuts', true, true, 11),
  ('22222222-2222-2222-2222-222222222222', 'Dozen Glazed Box', 'A full dozen of our classic glazed donuts. The crowd pleaser.', 11.99, 'donuts', true, true, 12);

-- ============================================================
-- MENU ITEMS: COFFEE
-- ============================================================
insert into dd_menu_items (shop_id, name, description, price, category, is_available, is_featured, sort_order)
values
  ('22222222-2222-2222-2222-222222222222', 'Drip Coffee', 'Fresh brewed house coffee. Available in regular or decaf.', 2.50, 'coffee', true, false, 1),
  ('22222222-2222-2222-2222-222222222222', 'Iced Coffee', 'Chilled drip coffee served over ice with cream.', 3.50, 'coffee', true, true, 2),
  ('22222222-2222-2222-2222-222222222222', 'Latte', 'Espresso with steamed milk. Smooth and creamy.', 4.50, 'coffee', true, true, 3),
  ('22222222-2222-2222-2222-222222222222', 'Cappuccino', 'Espresso with equal parts steamed milk and foam.', 4.00, 'coffee', true, false, 4),
  ('22222222-2222-2222-2222-222222222222', 'Cold Brew', 'Slow-steeped for 20 hours. Bold and smooth.', 4.00, 'coffee', true, false, 5),
  ('22222222-2222-2222-2222-222222222222', 'Hot Chocolate', 'Rich chocolate with steamed milk topped with whipped cream.', 3.50, 'coffee', true, false, 6);

-- ============================================================
-- MENU ITEMS: BREAKFAST
-- ============================================================
insert into dd_menu_items (shop_id, name, description, price, category, is_available, is_featured, sort_order)
values
  ('22222222-2222-2222-2222-222222222222', 'Breakfast Sandwich', 'Egg, cheese, and choice of bacon or sausage on a toasted croissant.', 5.99, 'breakfast', true, true, 1),
  ('22222222-2222-2222-2222-222222222222', 'Kolache Sausage', 'Czech-style pastry stuffed with savory sausage and cheese.', 3.50, 'breakfast', true, false, 2),
  ('22222222-2222-2222-2222-222222222222', 'Kolache Cream Cheese', 'Sweet pastry filled with rich cream cheese filling.', 3.50, 'breakfast', true, false, 3),
  ('22222222-2222-2222-2222-222222222222', 'Croissant', 'Buttery, flaky croissant baked fresh daily.', 3.00, 'breakfast', true, false, 4),
  ('22222222-2222-2222-2222-222222222222', 'Bagel & Cream Cheese', 'Toasted bagel served with a generous spread of cream cheese.', 3.99, 'breakfast', true, false, 5);
