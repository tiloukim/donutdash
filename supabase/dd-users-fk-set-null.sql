-- Fix foreign keys that block dd_users deletion.
--
-- Many tables reference dd_users(id) without an ON DELETE clause, so
-- PostgreSQL defaults to NO ACTION — every attempted user delete from
-- /admin/users dies on the first FK that has historical rows. The
-- original error: "violates foreign key constraint dd_pageviews_user_id_fkey".
--
-- Right pattern per table type:
--   • Analytics / historical events / financial records → ON DELETE SET NULL
--     (preserve aggregates + audit trail with no PII reference)
--   • Personal data (favorites, push subs, loyalty) → ON DELETE CASCADE
--     (already configured for these)
--
-- Each block is guarded with to_regclass() so the script tolerates
-- tables that exist in SQL files but were never applied to this DB.
-- Re-running is safe; constraint drop is idempotent via IF EXISTS.

create or replace function _fix_user_fk(p_table text, p_column text, p_constraint text)
returns void language plpgsql as $$
begin
  if to_regclass(p_table) is null then
    raise notice 'skipping %: table does not exist', p_table;
    return;
  end if;
  execute format('alter table %I drop constraint if exists %I', p_table, p_constraint);
  execute format(
    'alter table %I add constraint %I foreign key (%I) references dd_users(id) on delete set null',
    p_table, p_constraint, p_column
  );
  raise notice 'fixed %.%', p_table, p_column;
end$$;

-- Analytics / events
select _fix_user_fk('dd_pageviews',        'user_id',   'dd_pageviews_user_id_fkey');
select _fix_user_fk('dd_chat_messages',    'sender_id', 'dd_chat_messages_sender_id_fkey');
select _fix_user_fk('dd_support_messages', 'sender_id', 'dd_support_messages_sender_id_fkey');

-- Financial / historical records
select _fix_user_fk('dd_deliveries',        'driver_id',   'dd_deliveries_driver_id_fkey');
select _fix_user_fk('dd_disputes',          'customer_id', 'dd_disputes_customer_id_fkey');
select _fix_user_fk('dd_disputes',          'resolved_by', 'dd_disputes_resolved_by_fkey');
select _fix_user_fk('dd_catering_requests', 'customer_id', 'dd_catering_requests_customer_id_fkey');
select _fix_user_fk('dd_reviews',           'customer_id', 'dd_reviews_customer_id_fkey');
select _fix_user_fk('dd_reviews',           'driver_id',   'dd_reviews_driver_id_fkey');
select _fix_user_fk('dd_gift_cards',        'purchased_by','dd_gift_cards_purchased_by_fkey');
select _fix_user_fk('dd_gift_cards',        'redeemed_by', 'dd_gift_cards_redeemed_by_fkey');
select _fix_user_fk('dd_loyalty_redemptions','user_id',    'dd_loyalty_redemptions_user_id_fkey');

-- Referrals (self-ref + dedicated tables)
select _fix_user_fk('dd_users',          'referred_by',       'dd_users_referred_by_fkey');
select _fix_user_fk('dd_referrals',      'referrer_id',       'dd_referrals_referrer_id_fkey');
select _fix_user_fk('dd_referrals',      'referee_id',        'dd_referrals_referee_id_fkey');
select _fix_user_fk('dd_shop_referrals', 'referrer_user_id',  'dd_shop_referrals_referrer_user_id_fkey');
select _fix_user_fk('dd_shop_referrals', 'referee_user_id',   'dd_shop_referrals_referee_user_id_fkey');

-- Document audit fields
select _fix_user_fk('dd_shop_documents',   'uploaded_by', 'dd_shop_documents_uploaded_by_fkey');
select _fix_user_fk('dd_shop_documents',   'reviewed_by', 'dd_shop_documents_reviewed_by_fkey');
select _fix_user_fk('dd_driver_documents', 'reviewed_by', 'dd_driver_documents_reviewed_by_fkey');

-- POS shift / drawer attribution
select _fix_user_fk('dd_shifts',           'user_id',   'dd_shifts_user_id_fkey');
select _fix_user_fk('dd_drawer_sessions',  'opened_by', 'dd_drawer_sessions_opened_by_fkey');
select _fix_user_fk('dd_drawer_sessions',  'closed_by', 'dd_drawer_sessions_closed_by_fkey');

-- Group orders
select _fix_user_fk('dd_group_orders',     'host_id', 'dd_group_orders_host_id_fkey');
select _fix_user_fk('dd_group_order_items','user_id', 'dd_group_order_items_user_id_fkey');

drop function _fix_user_fk(text, text, text);
