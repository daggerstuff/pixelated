import { fheService } from '@/lib/fhe'
import { useEffect, useState } from 'react'

export type SecurityLevel = 'standard' | 'hipaa' | 'maximum'

interface SecurityState {
  securityLevel: SecurityLevel
  encryptionEnabled: boolean
  fheInitialized: boolean
}

export function useSecurity() {
  const [state, setState] = useState<SecurityState>({
    securityLevel: 'hipaa',
    encryptionEnabled: true,
    fheInitialized: false,
  })

  useEffect(() => {
    const initializeSecurity = async () => {
      if (state.encryptionEnabled && !state.fheInitialized) {
        try {
          await fheService.initialize()
          setState((prev) => ({ ...prev, fheInitialized: true }))
        } catch (error) {
          console.error('Failed to initialize FHE:', error)
          // Fall back to standard security if FHE initialization fails
          if (state.securityLevel === 'maximum') {
            setState((prev) => ({
              ...prev,
              securityLevel: 'hipaa',
              encryptionEnabled: true,
            }))
          }
        }
      }
    }

    initializeSecurity()
  }, [state.encryptionEnabled, state.securityLevel, state.fheInitialized])

  const setSecurityLevel = (level: SecurityLevel) => {
    setState((prev) => ({ ...prev, securityLevel: level }))
  }

  const toggleEncryption = () => {
    setState((prev) => ({
      ...prev,
      encryptionEnabled: !prev.encryptionEnabled,
    }))
  }

  return {
    ...state,
    setSecurityLevel,
    toggleEncryption,
  }
}
