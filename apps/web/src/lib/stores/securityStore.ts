import { create } from 'zustand'
import { devtools, subscribeWithSelector, persist } from 'zustand/middleware'

import type { AIService } from '../ai/models/ai-types'
import { createMentalHealthChat } from '../chat'
import type { FHEService } from '../fhe'

interface SecurityState {
  securityLevel: 'standard' | 'hipaa' | 'maximum'
  encryptionEnabled: boolean
  fheInitialized: boolean
  aiService: AIService
  fheService: FHEService | null
  mentalHealthChat: ReturnType<typeof createMentalHealthChat> | null
  mentalHealthAnalysisEnabled: boolean
  expertGuidanceEnabled: boolean

  setSecurityLevel: (level: 'standard' | 'hipaa' | 'maximum') => void
  setEncryptionEnabled: (enabled: boolean) => void
  setFHEInitialized: (initialized: boolean) => void
  setAIService: (service: AIService) => void
  initializeMentalHealthChat: () => ReturnType<typeof createMentalHealthChat> | null
  configureMentalHealthAnalysis: (enableAnalysis: boolean, useExpertGuidance: boolean) => void
}

export const useSecurityStore = create<SecurityState>()(
  devtools(
    subscribeWithSelector(
      persist(
        (set, get): SecurityState => ({
          securityLevel: 'hipaa',
          encryptionEnabled: true,
          fheInitialized: false,
          aiService: null as unknown as AIService,
          fheService: null,
          mentalHealthChat: null,
          mentalHealthAnalysisEnabled: true,
          expertGuidanceEnabled: true,

          setSecurityLevel: (level) => set({ securityLevel: level }),
          setEncryptionEnabled: (enabled) => set({ encryptionEnabled: enabled }),
          setFHEInitialized: (initialized) => set({ fheInitialized: initialized }),
          setAIService: (service) => set({ aiService: service }),
          initializeMentalHealthChat: () => {
            if (get().fheService) {
              const mentalHealthChat = createMentalHealthChat(get().fheService!, {
                enableAnalysis: get().mentalHealthAnalysisEnabled,
                useExpertGuidance: get().expertGuidanceEnabled,
              })
              set({ mentalHealthChat })
              return mentalHealthChat
            }
            return null
          },
          configureMentalHealthAnalysis: (enableAnalysis, useExpertGuidance) => {
            set({ mentalHealthAnalysisEnabled: enableAnalysis, expertGuidanceEnabled: useExpertGuidance })
            const { mentalHealthChat } = get()
            if (mentalHealthChat) {
              mentalHealthChat.configure({ enableAnalysis, useExpertGuidance })
            }
          },
        }),
        {
          name: 'therapy-state-security',
          partialize: (state) => ({
            securityLevel: state.securityLevel,
            encryptionEnabled: state.encryptionEnabled,
            mentalHealthAnalysisEnabled: state.mentalHealthAnalysisEnabled,
            expertGuidanceEnabled: state.expertGuidanceEnabled,
          }),
        },
      ),
    ),
  ),
)
