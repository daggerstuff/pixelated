/** @vitest-environment jsdom */
import { render, renderHook } from '@testing-library/react'
import React from 'react'
import { describe, expect, it } from 'vitest'

import {
  AnimatePresence,
  motion,
  useAnimation,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from './framer-motion'

describe('framer-motion shim', () => {
  it('motion.div renders a real div and strips animation props', () => {
    const DivMotion = motion['div']
    const { container } = render(
      <DivMotion
        className="box"
        data-testid="box"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        layout
        layoutId="shared"
      >
        content
      </DivMotion>,
    )

    const element = container.firstChild as HTMLElement
    expect(element?.tagName).toBe('DIV')
    expect(element).toHaveClass('box')
    expect(element).toHaveAttribute('data-testid', 'box')
    expect(element).not.toHaveAttribute('initial')
    expect(element).not.toHaveAttribute('animate')
    expect(element).not.toHaveAttribute('exit')
    expect(element).not.toHaveAttribute('whilehover')
  })

  it('motion.span forwards children and refs', () => {
    const SpanMotion = motion['span']
    const { container } = render(<SpanMotion>text</SpanMotion>)
    const element = container.firstChild as HTMLElement
    expect(element?.tagName).toBe('SPAN')
    expect(element?.textContent).toBe('text')
  })

  it('AnimatePresence renders its children without animation', () => {
    const { getByText } = render(
      <AnimatePresence mode="wait">
        <div>child</div>
      </AnimatePresence>,
    )

    expect(getByText('child')).toBeInTheDocument()
  })

  it('useAnimation returns no-op controls', async () => {
    const { result } = renderHook(() => useAnimation())
    const controls = result.current

    await expect(controls.start({ opacity: 1 })).resolves.toBeUndefined()
    expect(() => controls.stop()).not.toThrow()
    expect(() => controls.set({ opacity: 0 })).not.toThrow()
    expect(typeof controls.mount()).toBe('function')
  })

  it('useMotionValue stores and returns values', () => {
    const { result } = renderHook(() => useMotionValue(42))
    const value = result.current

    expect(value.get()).toBe(42)

    value.set(100)
    expect(value.get()).toBe(100)

    const unsubscribe = value.onChange(() => {})
    expect(typeof unsubscribe).toBe('function')
    expect(() => unsubscribe()).not.toThrow()
  })

  it('useTransform returns the first output value', () => {
    const { result: inputRef } = renderHook(() => useMotionValue(0))
    const { result } = renderHook(() =>
      useTransform(inputRef.current, [0, 1], ['a', 'b']),
    )

    expect(result.current.get()).toBe('a')
  })

  it('useSpring returns the numeric value as a motion value', () => {
    const { result } = renderHook(() => useSpring(5))

    expect(result.current.get()).toBe(5)
  })

  it('useScroll returns zero motion values', () => {
    const { result } = renderHook(() => useScroll())
    const { scrollX, scrollY, scrollXProgress, scrollYProgress } =
      result.current

    expect(scrollX.get()).toBe(0)
    expect(scrollY.get()).toBe(0)
    expect(scrollXProgress.get()).toBe(0)
    expect(scrollYProgress.get()).toBe(0)
  })

  it('useInView always returns false', () => {
    const { result } = renderHook(() => useInView())

    expect(result.current).toBe(false)
  })
})
