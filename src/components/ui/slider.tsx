import React from 'react'

interface SliderProps {
  value?: number[]
  defaultValue?: number[]
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  orientation?: 'horizontal' | 'vertical'
  onValueChange?: (value: number[]) => void
  className?: string
}

const Slider: FC<SliderProps> = ({
  value,
  defaultValue = [0],
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  orientation = 'horizontal',
  onValueChange,
  className = '',
}) => {
  const [internalValue, setInternalValue] = React.useState(
    value || defaultValue,
  )

  const currentValue = value || internalValue
  const sliderValue = currentValue[0] || 0

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = [Number(e.target.value)]
    if (!value) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }

  const isVertical = orientation === 'vertical'

  return (
    <div
      className={`relative ${isVertical ? 'h-32 w-6' : 'h-6 w-full'} ${className}`}
    >
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        disabled={disabled}
        onChange={handleChange}
        className={`bg-transparent slider-input cursor-pointer appearance-none ${isVertical ? 'slider-vertical' : 'h-2 w-full'} ${disabled ? 'cursor-not-allowed opacity-50' : ''} `}
        style={{
          background: `linear-gradient(to ${isVertical ? 'top' : 'right'}, 
            #3b82f6 0%, #3b82f6 ${((sliderValue - min) / (max - min)) * 100}%, 
            #e5e7eb ${((sliderValue - min) / (max - min)) * 100}%, #e5e7eb 100%)`,
        }}
      />
    </div>
  )
}

export { Slider }
export default Slider
