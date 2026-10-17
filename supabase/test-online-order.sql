-- Create a test ONLINE order on the DONUT Demo Store, so it appears on the
-- register's online-order side panel.
--
-- The panel polls dd_orders for order_type in ('delivery','pickup') and shows
-- the ones whose status is pending / confirmed / preparing / ready_for_pickup
-- (components/OnlineOrderSidePanel.tsx). 'pending' is the one that arrives
-- with the accept/reject buttons, so that is what this inserts.
--
-- Safe to run repeatedly: every run makes one new order. The cleanup at the
-- bottom removes every test order this script has made, and nothing else —
-- they are tagged by customer_name.
--
-- Demo store only. Nothing here touches a real shop.

do $$
declare
  v_shop   uuid := '7536a7db-f8d0-4534-8079-4e6e2c199326';  -- DONUT Demo Store
  v_order  uuid;
  v_sub    numeric := 0;
  v_tax    numeric;
  v_total  numeric;
  r        record;
begin
  insert into public.dd_orders (
    shop_id, order_type, status, payment_method,
    customer_name, customer_phone,
    subtotal, tax, tax_rate, total,
    delivery_address, delivery_city,
    -- EXPLICITLY pickup. fulfillment_type defaults to 'delivery', and the
    -- orphan-dispatch cron picks up any non-walkin delivery order that
    -- reaches confirmed/preparing/ready — so accepting a test order on the
    -- register would have created a real delivery and offered it to a REAL
    -- driver. A test order must never be able to dispatch anyone.
    fulfillment_type
  ) values (
    v_shop, 'pickup', 'pending', 'card_online',
    'TEST ORDER', '9035550123',
    0, 0, 0.0825, 0,
    null, null,
    'pickup'
  ) returning id into v_order;

  -- Three real items off the demo menu, priced at their ONLINE price - which
  -- is the point of the separate column, and worth seeing on the ticket.
  for r in
    select id, name, coalesce(online_price, pos_price, price) as price
      from public.dd_menu_items
     where shop_id = v_shop
       and available_for_online
     order by sort_order
     limit 3
  loop
    insert into public.dd_order_items (order_id, menu_item_id, name, price, quantity)
    values (v_order, r.id, r.name, r.price, 2);
    v_sub := v_sub + r.price * 2;
  end loop;

  v_tax   := round(v_sub * 0.0825, 2);
  v_total := v_sub + v_tax;

  update public.dd_orders
     set subtotal = v_sub, tax = v_tax, total = v_total
   where id = v_order;

  raise notice 'Test order % created: $% (% items)', v_order, v_total, 3;
end $$;

-- What you just made:
select o.short_code, o.status, o.order_type, o.total, o.created_at,
       count(i.id) as items
  from public.dd_orders o
  left join public.dd_order_items i on i.order_id = o.id
 where o.shop_id = '7536a7db-f8d0-4534-8079-4e6e2c199326'
   and o.customer_name = 'TEST ORDER'
 group by o.id
 order by o.created_at desc;

-- ── CLEANUP — run this when you are done testing ──
-- delete from public.dd_order_items
--  where order_id in (select id from public.dd_orders
--                      where shop_id = '7536a7db-f8d0-4534-8079-4e6e2c199326'
--                        and customer_name = 'TEST ORDER');
-- delete from public.dd_orders
--  where shop_id = '7536a7db-f8d0-4534-8079-4e6e2c199326'
--    and customer_name = 'TEST ORDER';
