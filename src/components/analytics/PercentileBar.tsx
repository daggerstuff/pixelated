import type { FC } from 'react'

interface PercentileBarProps {
  rank: number
  label?: string
}

export const PercentileBar: FC<PercentileBarProps> = ({
  rank,
  label,
}) => {
  // Validate rank is between 0 and 100
  const validRank = Math.min(Math.max(0, isNaN(rank) ? 0 : rank), 100)

  // Determine color based on percentile (better contrast)
  const getBarColor = (value: number): string => {
    if (value < 30) {
      return '#d9534f' // red (danger) for low values
    }
    if (value < 70) {
      return '#f0ad4e' // yellow (warning) for medium values
    }
    return '#5cb85c' // green (success) for high values
  }

  const barColor = getBarColor(validRank)

  return (
    <div
      style={{ border: '1px solid #eee', padding: '10px', margin: '10px 0' }}
      aria-label={`Percentile rank visualization: ${validRank}%`}
    >
      <div
        style={{ width: '100%', backgroundColor: '#ddd' }}
        role="progressbar"
        aria-valuenow={validRank}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || `Percentile rank: ${validRank}%`}
      >
        <div
          style={{
            width: `${validRank}%`,
            backgroundColor: barColor,
            height: '20px',
            textAlign: 'center',
            color: 'white',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '30px', // Ensure text is visible even for very low percentiles
          }}
        >
          {validRank}%
        </div>
      </div>
    </div>
  )
}
