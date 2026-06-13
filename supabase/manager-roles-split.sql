-- Split platform-wide 'manager' into three specialized roles:
-- marketing_manager, field_manager, general_manager.
--
-- Order: drop old constraint -> migrate rows -> add new constraint,
-- so existing 'manager' rows never fail the check mid-migration.

alter table dd_users drop constraint if exists dd_users_role_check;

update dd_users set role = 'general_manager' where role = 'manager';

alter table dd_users add constraint dd_users_role_check
  check (role in (
    'customer',
    'driver',
    'shop_owner',
    'admin',
    'general_manager',
    'field_manager',
    'marketing_manager',
    'cashier'
  ));
