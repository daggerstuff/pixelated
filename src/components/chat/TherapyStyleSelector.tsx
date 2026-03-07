import React, { useState, type FC } from 'react'
import type { TherapyStyleId, TherapyStyle } from '../../lib/ai/types/TherapyStyles'
import {
  therapyStyleConfigs,
  getRecommendedStyles,
} from '../../lib/ai/types/TherapyStyles'

interface TherapyStyleSelectorProps {
  selectedStyle: TherapyStyleId
  onSelectStyle: (styleId: TherapyStyleId) => void
  issue?: string
  showRecommendations?: boolean
}

export const TherapyStyleSelector: FC<TherapyStyleSelectorProps> = ({
  selectedStyle,
  onSelectStyle,
  issue,
  showRecommendations = false,
}) => {
  const [hoveredStyle, setHoveredStyle] = useState<TherapyStyleId | null>(null)

  // Get the style to display details for (either hovered or selected)
  const detailStyle: TherapyStyleId = hoveredStyle || selectedStyle

  // Get recommended styles if enabled and an issue is provided
  const recommendedStyles =
    showRecommendations && issue ? getRecommendedStyles(issue) : []

  // Create a set of recommended style IDs for easy lookup
  const recommendedStyleIds = new Set(recommendedStyles)

  // Handler for style button click
  const handleStyleClick = (styleId: TherapyStyleId) => {
    onSelectStyle(styleId)
  }

  // Handler for mouse enter on style button
  const handleMouseEnter = (styleId: TherapyStyleId) => {
    setHoveredStyle(styleId)
  }

  // Handler for mouse leave on style button
  const handleMouseLeave = () => {
    setHoveredStyle(null)
  }

  // Get the current style details to display in the panel
  const currentStyle: TherapyStyle = therapyStyleConfigs[detailStyle]

  return (
    <div className="therapy-style-selector">
      <div className="style-options">
        <h3>Select Therapy Approach</h3>
        <div className="style-buttons">
          {Object.entries(therapyStyleConfigs).map(([id, style]) => {
            const isActive = id === selectedStyle
            const isRecommended = recommendedStyleIds.has(id as TherapyStyleId)

            return (
              <button
                key={id}
                className={`style-button ${isActive ? 'active' : ''} ${isRecommended ? 'recommended' : ''}`}
                onClick={() => handleStyleClick(id as TherapyStyleId)}
                onMouseEnter={() => handleMouseEnter(id as TherapyStyleId)}
                onMouseLeave={handleMouseLeave}
              >
                {style.name}
                {isRecommended && (
                  <span className="recommendation-badge">✓ Recommended</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="style-details">
        <h3>{currentStyle.name}</h3>
        <p className="style-description">{currentStyle.description}</p>

        <div className="style-techniques">
          <h4>Techniques Used:</h4>
          <ul>
            {currentStyle.techniques.map((technique) => (
              <li key={technique}>{technique}</li>
            ))}
          </ul>
        </div>

        <div className="style-issues">
          <h4>Recommended For:</h4>
          <ul>
            {currentStyle.suitableFor.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      </div>

      <style>{`
        .therapy-style-selector {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          padding: 1rem;
          background-color: var(--color-background-secondary, #f5f7f9);
          border-radius: 8px;
        }

        .style-options {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .style-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .style-button {
          position: relative;
          padding: 0.625rem 1rem;
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 6px;
          background-color: var(--color-background, white);
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.875rem;
        }

        .style-button:hover {
          background-color: var(--color-background-hover, #edf2f7);
        }

        .style-button.active {
          background-color: var(--color-primary-light, #ebf8ff);
          border-color: var(--color-primary, #4299e1);
          color: var(--color-primary-dark, #2b6cb0);
          font-weight: 500;
        }

        .style-button.recommended {
          border-color: var(--color-success, #48bb78);
        }

        .recommendation-badge {
          display: block;
          position: absolute;
          top: -8px;
          right: -8px;
          font-size: 0.75rem;
          background-color: var(--color-success, #48bb78);
          color: white;
          padding: 2px 4px;
          border-radius: 4px;
          white-space: nowrap;
        }

        .style-details {
          padding: 1.25rem;
          background-color: var(--color-background, white);
          border-radius: 6px;
          border: 1px solid var(--color-border, #e2e8f0);
        }

        .style-description {
          margin-bottom: 1rem;
          color: var(--color-text-secondary, #4a5568);
          line-height: 1.5;
        }

        h3 {
          margin: 0 0 0.75rem 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--color-text-primary, #2d3748);
        }

        h4 {
          margin: 0.75rem 0 0.5rem 0;
          font-size: 1rem;
          font-weight: 500;
          color: var(--color-text-primary, #2d3748);
        }

        ul {
          margin: 0;
          padding-left: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        li {
          color: var(--color-text-secondary, #4a5568);
          line-height: 1.4;
        }

        @media (min-width: 640px) {
          .therapy-style-selector {
            flex-direction: row;
          }

          .style-options {
            flex: 1;
          }

          .style-details {
            flex: 2;
          }
        }
      `}</style>
    </div>
  )
}
