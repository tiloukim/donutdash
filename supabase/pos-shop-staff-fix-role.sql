-- Allow 'cashier' as a valid dd_users.role. The CHECK constraint
-- was originally minted with the marketplace roles only (customer,
-- driver, shop_owner, admin, manager). POS cashier rows from the
-- multi-cashier flow need this new value.
--
-- dd_users.role is the platform-wide identity; dd_shop_staff.role is
-- the per-shop assignment (which can be cashier / manager / owner
-- inside a specific shop). Two different layers, two different
-- enumerations.

alter table dd_users drop constraint if exists dd_users_role_check;
alter table dd_users add constraint dd_users_role_check
  check (role in ('customer', 'driver', 'shop_owner', 'admin', 'manager', 'cashier'));
