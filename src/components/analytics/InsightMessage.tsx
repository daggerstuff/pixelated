import React from 'react'

// Extracted to a separate constants file for better maintainability
export const TREND_CONFIGS = {
  info: {
    color: 'blue',
    label: 'Information',
    icon: 'ℹ️', // Using emoji as placeholder, consider importing proper icons
  },
  success: {
    color: 'green',
    label: 'Success',
    icon: '✅',
  },
  warning: {
    color: 'orange',
    label: 'Warning',
    icon: '⚠️',
  },
}

// Color mapping with rgba values for consistency
const COLOR_MAP = {
  blue: 'rgba(0, 0, 255, $opacity)',
  green: 'rgba(0, 128, 0, $opacity)',
  orange: 'rgba(255, 165, 0, $opacity)',
}

// Simple helper function that works in all environments
const getColorWithOpacity = (color: string, opacity: number): string => {
  const template =
    COLOR_MAP[color as keyof typeof COLOR_MAP] || 'rgba(0, 0, 0, $opacity)'
  return template.replace('$opacity', opacity.toString())
}

interface InsightMessageProps {
  summary: string
  trend: 'info' | 'success' | 'warning'
}

export const InsightMessage: React.FC<InsightMessageProps> = ({
  summary,
  trend,
}) => {
  const { color, label, icon } = TREND_CONFIGS[trend]

  return (
    <div
      style={{
        border: `1px solid ${color}`,
        padding: '10px',
        backgroundColor: getColorWithOpacity(color, 0.1), // Proper 10% opacity with rgba
      }}
      role="alert"
      aria-live="polite"
    >
      <div
        style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}
      >
        <span aria-hidden="true" style={{ marginRight: '8px' }}>
          {icon}
        </span>
        <span style={{ fontWeight: 'bold', color }}>{label}</span>
      </div>
      <p>{summary}</p>
    </div>
  )
}
