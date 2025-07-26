import React from 'react'
import styles from './ProgressDataDisplay.module.css'

interface ProgressDataDisplayProps {
  labels: string[]
  userData: number[]
  benchmarkData: number[]
  color: string
  title: string
  benchmarkLabel: string
}

export const ProgressDataDisplay: React.FC<ProgressDataDisplayProps> = ({
  labels = [],
  userData = [],
  benchmarkData = [],
  color,
  title,
  benchmarkLabel,
}) => {
  // Validate input data
  const hasValidData =
    labels.length > 0 &&
    userData.length > 0 &&
    benchmarkData.length > 0 &&
    labels.length === userData.length &&
    labels.length === benchmarkData.length

  // Format data safely
  const formattedLabels = Array.isArray(labels) ? labels.join(', ') : ''
  const formattedUserData = Array.isArray(userData) ? userData.join(', ') : ''
  const formattedBenchmarkData = Array.isArray(benchmarkData)
    ? benchmarkData.join(', ')
    : ''

  // Data display representation
  return (
    <div
      className={styles['chartContainer']}
      role="region"
      aria-labelledby="data-title data-description"
    >
      <h4 id="data-title" className={styles['chartTitle']}>
        {title}
      </h4>
      {hasValidData ? (
        <>
          <p id="data-description" className={styles['chartDescription']}>
            Data for: {formattedLabels}
          </p>

          {/* Add visual indicator and proper ARIA attributes for user data */}
          <div className={styles['dataRow']}>
            <span
              className={styles['colorIndicator']}
              style={{ '--indicator-color': color } as React.CSSProperties}
              aria-hidden="true"
            ></span>
            <p className={styles['dataText']}>
              <span className={styles['dataLabel']}>User Data:</span>{' '}
              <span
                className={styles['userData']}
                style={{ '--user-data-color': color } as React.CSSProperties}
              >
                {formattedUserData}
              </span>
              <span className="sr-only"> (represented in {color})</span>
            </p>
          </div>

          {/* Add visual indicator for benchmark data */}
          <div className={styles['dataRow']}>
            <span
              className={`${styles['colorIndicator']} ${styles['benchmarkIndicator']}`}
              aria-hidden="true"
            ></span>
            <p className={styles['dataText']}>
              <span className={styles['dataLabel']}>
                Benchmark ({benchmarkLabel}):
              </span>{' '}
              {formattedBenchmarkData}
            </p>
          </div>

          {/* Additional screen reader context that explains the data comparison */}
          <div className="sr-only" aria-live="polite">
            This data display compares user data {formattedUserData} with
            benchmark data for {benchmarkLabel} {formattedBenchmarkData} across
            the following categories: {formattedLabels}.
          </div>
        </>
      ) : (
        <p className={styles['noDataMessage']}>
          No valid data available to display
        </p>
      )}
    </div>
  )
}
