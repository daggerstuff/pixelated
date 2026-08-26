// RBAC middleware types
export interface Permission {
  resource: string
  action: 'create' | 'read' | 'update' | 'delete'
}

export interface Role {
  name: string
  permissions: Permission[]
}

export interface UserPermissions {
  userId: string
  roles: string[]
  permissions: Permission[]
}

export function checkPermission(
  user: UserPermissions,
  resource: string,
  action: string,
): boolean {
  return user.permissions.some(
    (p) => p.resource === resource && p.action === action,
  )
}
