import { cn } from '@/lib/utils'

import { IconShieldLock } from './icons'

interface SecurityBadgeProps {
  securityLevel: 'standard' | 'hipaa' | 'maximum'
  encryptionEnabled: boolean
  fheInitialized: boolean
}

export function SecurityBadge({
  securityLevel,
  encryptionEnabled,
  fheInitialized,
}: SecurityBadgeProps) {
  if (!encryptionEnabled) {
    return null
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-none border px-2 py-1 text-xs',
        securityLevel === 'maximum'
          ? 'border-input bg-secondary text-foreground'
          : securityLevel === 'hipaa'
            ? 'border-ring bg-secondary text-foreground'
            : 'border-border bg-secondary text-muted-foreground',
      )}
    >
      <IconShieldLock className="h-3 w-3" />
      <span>
        {securityLevel === 'maximum'
          ? fheInitialized
            ? 'FHE Secure'
            : 'FHE Initializing...'
          : securityLevel === 'hipaa'
            ? 'HIPAA Compliant'
            : 'Standard Security'}
      </span>
    </div>
  )
}
