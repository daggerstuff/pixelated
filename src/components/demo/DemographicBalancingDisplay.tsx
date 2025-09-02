import { useState, useEffect, FC } from 'react'
import type { PatientInfo } from '../../lib/types/psychology-pipeline'

interface DemographicData {
  category: string
  subcategory: string
  current: number
  target: number
  percentage: number
}

interface DemographicBalancingDisplayProps {
  currentProfile: PatientInfo
  onBalanceUpdate?: (balanceScore: number) => void
}

// Simulated demographic targets for training dataset balance
const demographicTargets = {
  age: {
    '18-25': 15,
    '26-35': 25,
    '36-50': 30,
    '51-65': 20,
    '65+': 10,
  },
  gender: {
    'female': 45,
    'male': 40,
    'non-binary': 10,
    'prefer not to say': 5,
  },
  occupation: {
    'Healthcare': 12,
    'Education': 15,
    'Technology': 18,
    'Business/Finance': 20,
    'Service Industry': 15,
    'Student': 10,
    'Retired': 5,
    'Other': 5,
  },
  background: {
    Urban: 60,
    Suburban: 25,
    Rural: 15,
  },
}

// Simulated current dataset statistics - moved outside component to prevent recreation on each render
const currentStats = {
  age: {
    '18-25': 12,
    '26-35': 28,
    '36-50': 25,
    '51-65': 22,
    '65+': 13,
  },
  gender: {
    'female': 52,
    'male': 35,
    'non-binary': 8,
    'prefer not to say': 5,
  },
  occupation: {
    'Healthcare': 15,
    'Education': 18,
    'Technology': 22,
    'Business/Finance': 18,
    'Service Industry': 12,
    'Student': 8,
    'Retired': 4,
    'Other': 3,
  },
  background: {
    Urban: 65,
    Suburban: 22,
    Rural: 13,
  },
}

const DemographicBalancingDisplay: FC<DemographicBalancingDisplayProps> = ({
  currentProfile,
  onBalanceUpdate,
}) => {
  const [demographicStats, setDemographicStats] = useState<DemographicData[]>([])
  const [overallBalance, setOverallBalance] = useState<number>(0)

  const getAgeCategory = (age: number): string => {
    if (age <= 25) {
      return '18-25'
    }
    if (age <= 35) {
      return '26-35'
    }
    if (age <= 50) {
      return '36-50'
    }
    if (age <= 65) {
      return '51-65'
    }
    return '65+'
  }

  const getOccupationCategory = (occupation: string): string => {
    const occ = occupation.toLowerCase()
    if (occ.includes('doctor') ||
          occ.includes('nurse') ||
          occ.includes('therapist') ||
          occ.includes('medical')) {
      return 'Healthcare'
    }
    if (occ.includes('teacher') ||
          occ.includes('professor') ||
          occ.includes('education')) {
      return 'Education'
    }
    if (occ.includes('engineer') ||
          occ.includes('developer') ||
          occ.includes('tech') ||
          occ.includes('software')) {
      return 'Technology'
    }
    if (occ.includes('manager') ||
          occ.includes('analyst') ||
          occ.includes('finance') ||
          occ.includes('business')) {
      return 'Business/Finance'
    }
    if (occ.includes('service') ||
          occ.includes('retail') ||
          occ.includes('restaurant')) {
      return 'Service Industry'
    }
    if (occ.includes('student')) {
      return 'Student'
    }
    if (occ.includes('retired')) {
      return 'Retired'
    }
    return 'Other'
  }

  const getBackgroundCategory = (background: string): string => {
    const bg = background.toLowerCase()
    if (bg.includes('urban') || bg.includes('city')) {
      return 'Urban'
    }
    if (bg.includes('suburban') || bg.includes('suburb')) {
      return 'Suburban'
    }
    if (bg.includes('rural') || bg.includes('country')) {
      return 'Rural'
    }
    return 'Urban' // Default
  }

  useEffect(() => {
    const stats: DemographicData[] = [
      // Age demographics
      ...Object.entries(demographicTargets.age).map(([category, target]) => ({
        category: 'Age',
        subcategory: category,
        current: currentStats.age[category as keyof typeof currentStats.age],
        target,
        percentage:
          (currentStats.age[category as keyof typeof currentStats.age] /
            target) *
          100,
      })),
      // Gender demographics
      ...Object.entries(demographicTargets.gender).map(
        ([category, target]) => ({
          category: 'Gender',
          subcategory: category,
          current:
            currentStats.gender[category as keyof typeof currentStats.gender],
          target,
          percentage:
            (currentStats.gender[category as keyof typeof currentStats.gender] /
              target) *
            100,
        }),
      ),
      // Occupation demographics
      ...Object.entries(demographicTargets.occupation).map(
        ([category, target]) => ({
          category: 'Occupation',
          subcategory: category,
          current:
            currentStats.occupation[
              category as keyof typeof currentStats.occupation
            ],
          target,
          percentage:
            (currentStats.occupation[
              category as keyof typeof currentStats.occupation
            ] /
              target) *
            100,
        }),
      ),
      // Background demographics
      ...Object.entries(demographicTargets.background).map(
        ([category, target]) => ({
          category: 'Background',
          subcategory: category,
          current:
            currentStats.background[
              category as keyof typeof currentStats.background
            ],
          target,
          percentage:
            (currentStats.background[
              category as keyof typeof currentStats.background
            ] /
              target) *
            100,
        }),
      ),
    ]

    setDemographicStats(stats)

    // Calculate overall balance score
    const balanceScore =
      stats.reduce((acc, stat) => {
        const deviation = Math.abs(stat.percentage - 100)
        return acc + (100 - Math.min(deviation, 100))
      }, 0) / stats.length

    setOverallBalance(balanceScore)
    onBalanceUpdate?.(balanceScore)
  }, [
    currentProfile, 
    onBalanceUpdate
  ])

  const getBalanceColor = (percentage: number) => {
    if (percentage >= 90 && percentage <= 110) {
      return 'text-green-600 bg-green-50'
    }
    if (percentage >= 75 && percentage <= 125) {
      return 'text-yellow-600 bg-yellow-50'
    }
    return 'text-red-600 bg-red-50'
  }

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 90 && percentage <= 110) {
      return 'bg-green-500'
    }
    if (percentage >= 75 && percentage <= 125) {
      return 'bg-yellow-500'
    }
    return 'bg-red-500'
  }

  const getCurrentProfileHighlight = (
    category: string,
    subcategory: string,
  ) => {
    const ageCategory = getAgeCategory(currentProfile.age)
    const genderCategory = currentProfile.gender
    const occupationCategory = getOccupationCategory(currentProfile.occupation)
    const backgroundCategory = getBackgroundCategory(currentProfile.background)

    if (category === 'Age' && subcategory === ageCategory) {
      return true
    }
    if (category === 'Gender' && subcategory === genderCategory) {
      return true
    }
    if (category === 'Occupation' && subcategory === occupationCategory) {
      return true
    }
    if (category === 'Background' && subcategory === backgroundCategory) {
      return true
    }
    return false
  }

  const groupedStats = demographicStats.reduce(
    (acc, stat) => {
      if (!acc[stat.category]) {
        acc[stat.category] = []
      }
      acc[stat.category]!.push(stat)
      return acc
    },
    {} as Record<string, DemographicData[]>,
  )

  return (
    <div className="demographic-balancing-display bg-white rounded-lg p-6 border shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-lg font-semibold text-gray-800">
          Demographic Balance & Diversity
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Overall Balance:</span>
          <div
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              overallBalance >= 85
                ? 'bg-green-100 text-green-800'
                : overallBalance >= 70
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {overallBalance.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Current Profile Summary */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
        <h5 className="font-medium text-blue-800 mb-2">
          Current Profile Classification
        </h5>
        <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
          <div>
            <strong>Age Group:</strong> {getAgeCategory(currentProfile.age)}
          </div>
          <div>
            <strong>Gender:</strong> {currentProfile.gender}
          </div>
          <div>
            <strong>Occupation Type:</strong>{' '}
            {getOccupationCategory(currentProfile.occupation)}
          </div>
          <div>
            <strong>Background:</strong>{' '}
            {getBackgroundCategory(currentProfile.background)}
          </div>
        </div>
      </div>

      {/* Demographic Categories */}
      <div className="space-y-6">
        {Object.entries(groupedStats).map(([category, stats]) => (
          <div key={category} className="border rounded-lg p-4">
            <h5 className="font-medium text-gray-700 mb-3">
              {category} Distribution
            </h5>
            <div className="space-y-3">
              {stats.map((stat) => {
                const isCurrentProfile = getCurrentProfileHighlight(
                  category,
                  stat.subcategory,
                )
                return (
                  <div
                    key={stat.subcategory}
                    className={`
                    flex items-center justify-between p-2 rounded
                    ${isCurrentProfile ? 'bg-blue-100 border border-blue-300' : 'bg-gray-50'}
                  `}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-medium ${isCurrentProfile ? 'text-blue-800' : 'text-gray-700'}`}
                      >
                        {stat.subcategory}
                        {isCurrentProfile && (
                          <span className="ml-1 text-xs">(Current)</span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-600">
                        {stat.current}% / {stat.target}%
                      </div>

                      {/* Progress Bar */}
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${getProgressBarColor(stat.percentage)}`}
                          style={{
                            width: `${Math.min(stat.percentage, 100)}%`,
                          }}
                        />
                      </div>

                      <div
                        className={`text-xs px-2 py-1 rounded ${getBalanceColor(stat.percentage)}`}
                      >
                        {stat.percentage.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Balance Recommendations */}
      <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
        <h5 className="font-medium text-indigo-800 mb-3">
          Balance Recommendations
        </h5>
        <div className="text-sm text-indigo-700 space-y-2">
          {demographicStats
            .filter((stat) => stat.percentage < 75 || stat.percentage > 125)
            .slice(0, 3)
            .map((stat) => (
              <div key={`${stat.category}-${stat.subcategory}`} className="flex items-start gap-2">
                <span className="text-indigo-500">•</span>
                <span>
                  <strong>
                    {stat.category} - {stat.subcategory}:
                  </strong>{' '}
                  {stat.percentage < 75
                    ? `Under-represented (${stat.current}% vs ${stat.target}% target)`
                    : `Over-represented (${stat.current}% vs ${stat.target}% target)`}
                </span>
              </div>
            ))}
          {demographicStats.filter(
            (stat) => stat.percentage < 75 || stat.percentage > 125,
          ).length === 0 && (
            <p className="text-indigo-600">
              ✓ All demographic categories are well-balanced
            </p>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h6 className="text-sm font-medium text-gray-700 mb-2">
          Balance Indicators
        </h6>
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span>Well Balanced (90-110%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span>Acceptable (75-125%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span>Needs Attention (&lt;75% or &gt;125%)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DemographicBalancingDisplay