-- Add tax_id column to dd_shops for 1099-K reporting
alter table dd_shops add column if not exists tax_id text;
