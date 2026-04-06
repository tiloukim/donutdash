// Admin & Manager role checking helpers

// Routes accessible by both admin and manager
export function isAdminOrManager(role: string): boolean {
  return role === 'admin' || role === 'manager'
}

// Routes only accessible by admin (not manager)
export function isAdminOnly(role: string): boolean {
  return role === 'admin'
}

// Manager restricted actions
export const MANAGER_BLOCKED = [
  'process_payouts',    // Can view but not process
  'delete_users',       // Can edit but not delete
  'change_settings',    // No access to settings
  'view_tax',           // No access to tax center
]
