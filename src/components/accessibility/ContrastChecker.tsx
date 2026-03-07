import type { ChangeEvent } from 'react'
import { useState } from 'react'

export function ContrastChecker() {
  const [color1, setColor1] = useState('#FFFFFF')
  const [color2, setColor2] = useState('#000000')

  return (
    <div>
      <div>
        <label htmlFor="color1Input">
          Color 1:
          <input
            id="color1Input"
            type="color"
            value={color1}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setColor1(e.target.value)
            }
          />
        </label>
      </div>
      <div>
        <label htmlFor="color2Input">
          Color 2:
          <input
            id="color2Input"
            type="color"
            value={color2}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setColor2(e.target.value)
            }
          />
        </label>
      </div>
    </div>
  )
}
