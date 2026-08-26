import { useEffect, useState, useCallback } from 'react'

const konamiCode = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
]

export const useKonamiCode = (callback: () => void) => {
  const [keys, setKeys] = useState<string[]>([])

  const handler = useCallback(
    ({ key }: KeyboardEvent) => {
      if (key === 'Escape') {
        setKeys([])
        return
      }

      const newKeys = [...keys, key]

      if (newKeys.join('').includes(konamiCode.join(''))) {
        callback()
        setKeys([])
      } else {
        setKeys(newKeys)
      }
    },
    [keys, callback],
  )

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [handler])
}
