export const VALID_API_KEY_SCOPES = [
  'read',
  'write',
  'admin',
  'memory:read',
  'memory:write',
  'developer:manage',
  'analytics:read',
] as const

export type ApiKeyScope = (typeof VALID_API_KEY_SCOPES)[number]

export const DEFAULT_API_KEY_SCOPES: ApiKeyScope[] = ['read', 'write']
