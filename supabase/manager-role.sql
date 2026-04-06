-- Add manager role to dd_users
ALTER TABLE dd_users DROP CONSTRAINT IF EXISTS dd_users_role_check;
ALTER TABLE dd_users ADD CONSTRAINT dd_users_role_check CHECK (role IN ('customer', 'shop_owner', 'driver', 'admin', 'manager'));
