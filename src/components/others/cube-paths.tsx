'use client'

import { motion } from 'framer-motion'
// Replace Next.js font with @fontsource/inter
import '@fontsource/inter'
// Remove Next.js Image import

import { Button } from '~/components/ui/button'

// Replace Next.js font initialization with a CSS class
const interFont = 'font-["Inter"]'

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    opacity: 0.04 + i * 0.01,
    width: 0.3 + i * 0.02,
  }))

  return (
    <div className="absolute inset-0 pointer-events-none mix-blend-soft-light">
      <svg
        className="w-full h-full text-white"
        viewBox="0 0 696 316"
        fill="none"
      >
        <title>Ambient Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={path.opacity}
            initial={{ pathLength: 0.3, opacity: 0.4 }}
            animate={{
              pathLength: 1,
              opacity: [0.2, 0.4, 0.2],
              pathOffset: [0, 1, 0],
            }}
            transition={{
              duration: 25 + Math.random() * 10,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'linear',
            }}
          />
        ))}
      </svg>
    </div>
  )
}

export default function CubePaths() {
  return (
    <div
      className={`relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-neutral-900 ${interFont}`}
    >
      {/* Grain texture overlay */}
      <div
        className="fixed inset-0 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="absolute inset-0">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      <div className="relative z-10 container mx-auto px-4 md:px-6 text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2 }}
          className="max-w-4xl mx-auto"
        >
          <div className="mb-12 relative w-64 h-64 mx-auto">
            {/* Replace Next.js Image with standard img tag */}
            <img
              src="/images/placeholder-image.png"
              alt="Minimalist cube"
              width={400}
              height={400}
              className="object-contain"
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 1.5,
              delay: 1.2,
              ease: 'easeOut',
            }}
            className="mb-10 tracking-wider"
          >
            <div className="inline-flex items-center justify-center">
              <span className="text-xl md:text-2xl font-light text-neutral-300 tracking-[0.25em] font-['Inter']">
                <span className="text-white font-normal">03</span>
                <span className="mx-2 opacity-40">-</span>
                <span className="text-white font-normal">31</span>
                <span className="mx-2 opacity-40">-</span>
                <span className="text-white font-normal">25</span>
              </span>
            </div>
          </motion.div>

          <div className="inline-block group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-white/5 blur-xl" />

            <Button
              variant="ghost"
              className="relative px-7 py-5 text-base font-normal backdrop-blur-sm
            bg-white/5 hover:bg-white/10
            text-neutral-200 transition-all duration-300
            group-hover:-translate-y-0.5 border border-white/10
            hover:border-white/20 tracking-wide font-['Inter']"
            >
              <span className="opacity-90 group-hover:opacity-100 transition-opacity">
                Enter Dimension
              </span>
              <span
                className="ml-2 opacity-70 group-hover:opacity-100 group-hover:translate-x-1.5
                    transition-all duration-300"
              >
                →
              </span>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
