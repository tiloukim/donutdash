-- Fix foreign keys that block dd_users deletion.
--
-- Many tables reference dd_users(id) without an ON DELETE clause, so
-- PostgreSQL defaults to NO ACTION — every attempted user delete from
-- /admin/users dies on the first FK that has historical rows. The
-- error today: "violates foreign key constraint dd_pageviews_user_id_fkey".
--
-- Right pattern per table type:
--   • Analytics / historical events / financial records → ON DELETE SET NULL
--     (preserve aggregates + audit trail with no PII reference)
--   • Personal data (favorites, push subs, loyalty) → ON DELETE CASCADE
--     (already configured for these)
--
-- This migration only changes the NO-ACTION / blocking constraints to
-- SET NULL. Existing CASCADE / SET NULL constraints are untouched.

-- ── Analytics / events ──────────────────────────────────────────────
alter table dd_pageviews
  drop constraint if exists dd_pageviews_user_id_fkey,
  add  constraint dd_pageviews_user_id_fkey
    foreign key (user_id) references dd_users(id) on delete set null;

-- ── Messaging ──────────────────────────────────────────────────────
alter table dd_chat_messages
  drop constraint if exists dd_chat_messages_sender_id_fkey,
  add  constraint dd_chat_messages_sender_id_fkey
    foreign key (sender_id) references dd_users(id) on delete set null;

alter table dd_support_messages
  drop constraint if exists dd_support_messages_sender_id_fkey,
  add  constraint dd_support_messages_sender_id_fkey
    foreign key (sender_id) references dd_users(id) on delete set null;

-- ── Financial / historical records ─────────────────────────────────
-- dd_deliveries.driver_id — preserve delivery history when driver leaves
alter table dd_deliveries
  drop constraint if exists dd_deliveries_driver_id_fkey,
  add  constraint dd_deliveries_driver_id_fkey
    foreign key (driver_id) references dd_users(id) on delete set null;

-- dd_disputes — keep dispute history when customer or admin is removed
alter table dd_disputes
  drop constraint if exists dd_disputes_customer_id_fkey,
  add  constraint dd_disputes_customer_id_fkey
    foreign key (customer_id) references dd_users(id) on delete set null;

alter table dd_disputes
  drop constraint if exists dd_disputes_resolved_by_fkey,
  add  constraint dd_disputes_resolved_by_fkey
    foreign key (resolved_by) references dd_users(id) on delete set null;

-- dd_catering_requests — keep catering history
alter table dd_catering_requests
  drop constraint if exists dd_catering_requests_customer_id_fkey,
  add  constraint dd_catering_requests_customer_id_fkey
    foreign key (customer_id) references dd_users(id) on delete set null;

-- dd_reviews — keep reviews if author deleted
alter table dd_reviews
  drop constraint if exists dd_reviews_customer_id_fkey,
  add  constraint dd_reviews_customer_id_fkey
    foreign key (customer_id) references dd_users(id) on delete set null;

alter table dd_reviews
  drop constraint if exists dd_reviews_driver_id_fkey,
  add  constraint dd_reviews_driver_id_fkey
    foreign key (driver_id) references dd_users(id) on delete set null;

-- dd_gift_cards — keep gift-card history
alter table dd_gift_cards
  drop constraint if exists dd_gift_cards_purchased_by_fkey,
  add  constraint dd_gift_cards_purchased_by_fkey
    foreign key (purchased_by) references dd_users(id) on delete set null;

alter table dd_gift_cards
  drop constraint if exists dd_gift_cards_redeemed_by_fkey,
  add  constraint dd_gift_cards_redeemed_by_fkey
    foreign key (redeemed_by) references dd_users(id) on delete set null;

-- dd_loyalty_redemptions — keep redemption history
alter table dd_loyalty_redemptions
  drop constraint if exists dd_loyalty_redemptions_user_id_fkey,
  add  constraint dd_loyalty_redemptions_user_id_fkey
    foreign key (user_id) references dd_users(id) on delete set null;

-- ── Referrals (self-ref) ───────────────────────────────────────────
alter table dd_users
  drop constraint if exists dd_users_referred_by_fkey,
  add  constraint dd_users_referred_by_fkey
    foreign key (referred_by) references dd_users(id) on delete set null;

alter table dd_referrals
  drop constraint if exists dd_referrals_referrer_id_fkey,
  add  constraint dd_referrals_referrer_id_fkey
    foreign key (referrer_id) references dd_users(id) on delete set null;

alter table dd_referrals
  drop constraint if exists dd_referrals_referee_id_fkey,
  add  constraint dd_referrals_referee_id_fkey
    foreign key (referee_id) references dd_users(id) on delete set null;

alter table dd_shop_referrals
  drop constraint if exists dd_shop_referrals_referrer_user_id_fkey,
  add  constraint dd_shop_referrals_referrer_user_id_fkey
    foreign key (referrer_user_id) references dd_users(id) on delete set null;

alter table dd_shop_referrals
  drop constraint if exists dd_shop_referrals_referee_user_id_fkey,
  add  constraint dd_shop_referrals_referee_user_id_fkey
    foreign key (referee_user_id) references dd_users(id) on delete set null;

-- ── Document audit fields ──────────────────────────────────────────
alter table dd_shop_documents
  drop constraint if exists dd_shop_documents_uploaded_by_fkey,
  add  constraint dd_shop_documents_uploaded_by_fkey
    foreign key (uploaded_by) references dd_users(id) on delete set null;

alter table dd_shop_documents
  drop constraint if exists dd_shop_documents_reviewed_by_fkey,
  add  constraint dd_shop_documents_reviewed_by_fkey
    foreign key (reviewed_by) references dd_users(id) on delete set null;

alter table dd_driver_documents
  drop constraint if exists dd_driver_documents_reviewed_by_fkey,
  add  constraint dd_driver_documents_reviewed_by_fkey
    foreign key (reviewed_by) references dd_users(id) on delete set null;

-- ── POS shift / drawer attribution ─────────────────────────────────
alter table dd_shifts
  drop constraint if exists dd_shifts_user_id_fkey,
  add  constraint dd_shifts_user_id_fkey
    foreign key (user_id) references dd_users(id) on delete set null;

alter table dd_drawer_sessions
  drop constraint if exists dd_drawer_sessions_opened_by_fkey,
  add  constraint dd_drawer_sessions_opened_by_fkey
    foreign key (opened_by) references dd_users(id) on delete set null;

alter table dd_drawer_sessions
  drop constraint if exists dd_drawer_sessions_closed_by_fkey,
  add  constraint dd_drawer_sessions_closed_by_fkey
    foreign key (closed_by) references dd_users(id) on delete set null;

-- ── Group orders ───────────────────────────────────────────────────
alter table dd_group_orders
  drop constraint if exists dd_group_orders_host_id_fkey,
  add  constraint dd_group_orders_host_id_fkey
    foreign key (host_id) references dd_users(id) on delete set null;

alter table dd_group_order_items
  drop constraint if exists dd_group_order_items_user_id_fkey,
  add  constraint dd_group_order_items_user_id_fkey
    foreign key (user_id) references dd_users(id) on delete set null;
