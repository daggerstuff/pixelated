import Scene from '@/components/ui/rubiks-cube'

const DemoOne = () => {
  return (
    <div className='relative flex h-screen w-screen flex-col items-center justify-center'>
      <div className='absolute inset-0'>
        <Scene />
      </div>
      <h1 className='text-white mb-6 text-6xl font-bold tracking-tight mix-blend-difference md:text-8xl'>
        Solve the Complexity
      </h1>
      <p className='text-white max-w-2xl px-6 text-lg leading-relaxed mix-blend-exclusion md:text-xl'>
        One twist at a time.
      </p>
    </div>
  )
}

export { DemoOne }
