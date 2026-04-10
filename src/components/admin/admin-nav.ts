export interface AdminNavItem {
  id: string
  label: string
  href: string
  icon?: string
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/admin', icon: 'dashboard' },
  { id: 'users', label: 'Users', href: '/admin/users', icon: 'users' },
  {
    id: 'ai-performance',
    label: 'AI Performance',
    href: '/admin/ai-performance',
    icon: 'stats',
  },
  {
    id: 'ai-evidence-assistant',
    label: 'AI Evidence Assistant',
    href: '/admin/ai/evidence-assistant',
    icon: 'document',
  },
  {
    id: 'security',
    label: 'Security',
    href: '/admin/security-dashboard',
    icon: 'shield',
  },
  { id: 'dlp', label: 'DLP Rules', href: '/admin/dlp', icon: 'shield-check' },
  {
    id: 'backup-security',
    label: 'Backup Security',
    href: '/admin/backup-security',
    icon: 'database',
  },
  {
    id: 'data-transfer',
    label: 'Data Transfer',
    href: '/admin/data-transfer',
    icon: 'file-export',
  },
  {
    id: 'data-retention',
    label: 'Data Retention',
    href: '/admin/data-retention',
    icon: 'calendar',
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    href: '/admin/audit-logs',
    icon: 'list',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/settings',
    icon: 'settings',
  },
  {
    id: 'patient-rights',
    label: 'Patient Rights',
    href: '/admin/patient-rights',
    icon: 'user',
  },
]

export const SIMPLE_ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_ITEMS.filter(
  (item) =>
    item.id === 'dashboard' ||
    item.id === 'users' ||
    item.id === 'settings',
)

SIMPLE_ADMIN_NAV_ITEMS.splice(2, 0, {
  id: 'content',
  label: 'Content',
  href: '/admin/content',
  icon: 'document',
})
