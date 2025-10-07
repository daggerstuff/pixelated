import type { BgType } from '../../src/types'

type BackgroundBase64 = Record<BgType, string>

const backgroundBase64: BackgroundBase64 = {
  plum: '/images/backgrounds/plum.png',
  dot: '/images/backgrounds/dot.png',
  rose: '/images/backgrounds/rose.png',
  particle: '/images/backgrounds/particle.png',
} as const

export default backgroundBase64
