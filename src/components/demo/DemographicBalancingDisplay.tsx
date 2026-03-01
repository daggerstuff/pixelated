import { useState, useEffect, type FC } from 'react'

interface DemographicData {
  category: string
  subcategory: string
  current: number
  target: number
  percentage: number
}

interface DemographicBalancingDisplayProps {
  currentProfile: {
    age: number
    gender: string
    occupation: string
    background: string
  }
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
    female: 45,
    male: 40,
    'non-binary': 10,
    'prefer not to say': 5,
  },
  occupation: {
    Healthcare: 12,
    Education: 15,
    Technology: 18,
    'Business/Finance': 20,
    'Service Industry': 15,
    Student: 10,
    Retired: 5,
    Other: 5,
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
    female: 52,
    male: 35,
    'non-binary': 8,
    'prefer not to say': 5,
  },
  occupation: {
    Healthcare: 15,
    Education: 18,
    Technology: 22,
    'Business/Finance': 18,
    'Service Industry': 12,
    Student: 8,
    Retired: 4,
    Other: 3,
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
  const [demographicStats, setDemographicStats] = useState<DemographicData[]>(
    [],
  )
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

  const OCCUPATION_CATEGORIES: Record<string, readonly string[]> = {
    Healthcare: ['doctor', 'nurse', 'therapist', 'medical'],
    Education: ['teacher', 'professor', 'education'],
    Technology: ['engineer', 'developer', 'tech', 'software'],
    'Business/Finance': ['manager', 'analyst', 'finance', 'business'],
    'Service Industry': ['service', 'retail', 'restaurant'],
    Student: ['student'],
    Retired: ['retired'],
  } as const

  const getOccupationCategory = (occupation: string): string => {
    const occ = occupation.toLowerCase()
    for (const [category, keywords] of Object.entries(OCCUPATION_CATEGORIES)) {
      if (keywords.some((keyword) => occ.includes(keyword))) {
        return category
      }
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
  }, [currentProfile, onBalanceUpdate])

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
    const categoryMap: Record<string, string> = {
      Age: getAgeCategory(currentProfile.age),
      Gender: currentProfile.gender,
      Occupation: getOccupationCategory(currentProfile.occupation),
      Background: getBackgroundCategory(currentProfile.background),
    }

    return categoryMap[category] === subcategory
  }

  const groupedStats = demographicStats.reduce(
    (acc, stat) => {
      const { category } = stat
      if (!acc[category]) {
        acc[category] = []
      }
      ;(acc[category]).push(stat)
      return acc
    },
    {} as Record<string, DemographicData[]>,
  )

  return (
    <div className='bg-gray-100 rounded-lg p-4'>
      <div className='mb-4 flex items-center justify-between'>
        <h4 className='text-gray-800 text-xl font-bold'>
          Dataset Demographic Balance
        </h4>
        <div className='flex items-center gap-2'>
          <span className='text-gray-600 text-sm font-medium'>
            Overall Balance:
          </span>
          <span
            className={`rounded-full px-3 py-1 text-lg font-bold ${
              overallBalance > 85
                ? 'bg-green-100 text-green-800'
                : overallBalance > 70
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
            }`}
          >
            {overallBalance.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className='bg-blue-50 border-blue-400 mb-6 rounded-lg border-l-4 p-4'>
        <h5 className='text-blue-800 mb-2 font-medium'>
          Current Profile Classification
        </h5>
        <div className='text-blue-700 grid grid-cols-2 gap-4 text-sm'>
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
      <div className='space-y-6'>
        {Object.entries(groupedStats).map(([category, stats]) => (
          <div key={category} className='rounded-lg border p-4'>
            <h5 className='text-gray-700 mb-3 font-medium'>
              {category} Distribution
            </h5>
            <div className='space-y-3'>
              {stats.map((stat) => {
                const isCurrentProfile = getCurrentProfileHighlight(
                  category,
                  stat.subcategory,
                )
                return (
                  <div
                    key={stat.subcategory}
                    className={`flex items-center justify-between rounded p-2 ${isCurrentProfile ? 'bg-blue-100 border-blue-300 border' : 'bg-gray-50'} `}
                  >
                    <div className='flex items-center gap-3'>
                      <span
                        className={`text-sm font-medium ${isCurrentProfile ? 'text-blue-800' : 'text-gray-700'}`}
                      >
                        {stat.subcategory}
                        {isCurrentProfile && (
                          <span className='ml-1 text-xs'>(Current)</span>
                        )}
                      </span>
                    </div>

                    <div className='flex items-center gap-3'>
                      <div className='text-gray-600 text-xs'>
                        {stat.current}% / {stat.target}%
                      </div>

                      {/* Progress Bar */}
                      <div className='bg-gray-200 h-2 w-20 overflow-hidden rounded-full'>
                        <div
                          className={`h-full transition-all duration-300 ${getProgressBarColor(stat.percentage)}`}
                          style={{
                            width: `${Math.min(stat.percentage, 100)}%`,
                          }}
                        />
                      </div>

                      <div
                        className={`rounded px-2 py-1 text-xs ${getBalanceColor(stat.percentage)}`}
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
      <div className='bg-indigo-50 mt-6 rounded-lg p-4'>
        <h5 className='text-indigo-800 mb-3 font-medium'>
          Balance Recommendations
        </h5>
        <div className='text-indigo-700 space-y-2 text-sm'>
          {demographicStats
            .filter((stat) => stat.percentage < 75 || stat.percentage > 125)
            .slice(0, 3)
            .map((stat) => (
              <div
                key={`${stat.category}-${stat.subcategory}`}
                className='flex items-start gap-2'
              >
                <span className='text-indigo-500'>•</span>
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
            <p className='text-indigo-600'>
              ✓ All demographic categories are well-balanced
            </p>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className='bg-gray-50 mt-4 rounded-lg p-3'>
        <h6 className='text-gray-700 mb-2 text-sm font-medium'>
          Balance Indicators
        </h6>
        <div className='flex items-center gap-6 text-xs'>
          <div className='flex items-center gap-1'>
            <div className='bg-green-500 h-3 w-3 rounded'></div>
            <span>Well Balanced (90-110%)</span>
          </div>
          <div className='flex items-center gap-1'>
            <div className='bg-yellow-500 h-3 w-3 rounded'></div>
            <span>Acceptable (75-125%)</span>
          </div>
          <div className='flex items-center gap-1'>
            <div className='bg-red-500 h-3 w-3 rounded'></div>
            <span>Needs Attention (&lt;75% or &gt;125%)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DemographicBalancingDisplay
