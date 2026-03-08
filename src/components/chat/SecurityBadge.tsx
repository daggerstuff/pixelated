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
        'flex items-center gap-1 rounded-lg border px-2 py-1 text-xs',
        securityLevel === 'maximum'
          ? 'border-green-700 bg-green-900/30 text-green-400'
          : securityLevel === 'hipaa'
            ? 'border-blue-700 bg-blue-900/30 text-blue-400'
            : 'border-purple-700 bg-purple-900/30 text-purple-400',
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
