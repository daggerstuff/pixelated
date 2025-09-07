// Minimal placeholder for admin module
export function getAdminUsers() {
  // Return empty array for now
  return []
}

export const AdminPermission = {
  MANAGE_SECURITY: 'manage:security',
}

export const AdminService = {
  async getActiveSessions() {
    return []
  },
}
