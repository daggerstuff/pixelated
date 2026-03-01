import {
  Search,
  BookOpen,
  Brain,
  Users,
  Target,
  ChevronRight,
} from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Framework {
  id: string
  name: string
  category: string
  description: string
  techniques: string[]
  conditions: string[]
  evidenceLevel: string
  keyPrinciples: string[]
  developers?: string[]
  yearDeveloped?: number
  applications: string[]
}

interface FrameworksResponse {
  frameworks: Framework[]
  categories: string[]
  totalCount: number
  metadata: {
    processingTime: number
    evidenceBasedOnly: boolean
  }
}

export default function PsychologyFrameworksDemo() {
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [filteredFrameworks, setFilteredFrameworks] = useState<Framework[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFramework, setSelectedFramework] = useState<Framework | null>(
    null,
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedCondition, setSelectedCondition] = useState<string>('all')

  const filterFrameworks = useCallback(() => {
    let filtered = frameworks

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(
        (fw) =>
          fw.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fw.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fw.techniques.some((t) =>
            t.toLowerCase().includes(searchTerm.toLowerCase()),
          ) ||
          fw.conditions.some((c) =>
            c.toLowerCase().includes(searchTerm.toLowerCase()),
          ),
      )
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((fw) => fw.category === selectedCategory)
    }

    // Filter by condition
    if (selectedCondition !== 'all') {
      filtered = filtered.filter((fw) =>
        fw.conditions.some((c) =>
          c.toLowerCase().includes(selectedCondition.toLowerCase()),
        ),
      )
    }

    setFilteredFrameworks(filtered)
  }, [frameworks, searchTerm, selectedCategory, selectedCondition])

  // Load frameworks on component mount
  useEffect(() => {
    void loadFrameworks()
  }, [])

  // Filter frameworks when search/filter criteria change
  useEffect(() => {
    filterFrameworks()
  }, [filterFrameworks])

  const loadFrameworks = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/psychology/frameworks', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }

      const result: FrameworksResponse = await response.json()

      setFrameworks(result.frameworks)
      setCategories(result.categories)

      // Auto-select first framework if available
      if (result.frameworks.length > 0) {
        setSelectedFramework(result.frameworks[0] || null)
      }
    } catch (error: unknown) {
      console.error('Failed to load frameworks:', error)

      // Fallback to demo data
      const demoFrameworks: Framework[] = [
        {
          id: 'cbt',
          name: 'Cognitive Behavioral Therapy (CBT)',
          category: 'Cognitive-Behavioral',
          description:
            'Evidence-based therapeutic approach focusing on identifying and changing negative thought patterns and behaviors.',
          techniques: [
            'Cognitive Restructuring',
            'Behavioral Activation',
            'Exposure Therapy',
            'Thought Records',
          ],
          conditions: ['Depression', 'Anxiety Disorders', 'PTSD', 'OCD'],
          evidenceLevel: 'Strong',
          keyPrinciples: [
            'Thoughts, feelings, and behaviors are interconnected',
            'Focus on present-moment problems',
            'Active, collaborative approach',
            'Skills-based intervention',
          ],
          developers: ['Aaron Beck', 'Albert Ellis'],
          yearDeveloped: 1960,
          applications: [
            'Individual Therapy',
            'Group Therapy',
            'Self-Help',
            'Digital Interventions',
          ],
        },
        {
          id: 'dbt',
          name: 'Dialectical Behavior Therapy (DBT)',
          category: 'Mindfulness-Based',
          description:
            'Comprehensive treatment approach combining CBT techniques with mindfulness and distress tolerance skills.',
          techniques: [
            'Mindfulness',
            'Distress Tolerance',
            'Emotion Regulation',
            'Interpersonal Effectiveness',
          ],
          conditions: [
            'Borderline Personality Disorder',
            'Suicidal Ideation',
            'Self-Harm',
            'Emotional Dysregulation',
          ],
          evidenceLevel: 'Strong',
          keyPrinciples: [
            'Dialectical thinking',
            'Mindfulness as core skill',
            'Distress tolerance',
            'Validation and change balance',
          ],
          developers: ['Marsha Linehan'],
          yearDeveloped: 1980,
          applications: [
            'Individual Therapy',
            'Group Skills Training',
            'Intensive Outpatient',
            'Residential Treatment',
          ],
        },
        {
          id: 'act',
          name: 'Acceptance and Commitment Therapy (ACT)',
          category: 'Mindfulness-Based',
          description:
            'Behavioral approach using mindfulness and acceptance strategies to increase psychological flexibility.',
          techniques: [
            'Values Clarification',
            'Mindfulness Exercises',
            'Defusion Techniques',
            'Committed Action',
          ],
          conditions: [
            'Chronic Pain',
            'Anxiety',
            'Depression',
            'Substance Use',
          ],
          evidenceLevel: 'Moderate',
          keyPrinciples: [
            'Psychological flexibility',
            'Values-based living',
            'Acceptance over control',
            'Present-moment awareness',
          ],
          developers: ['Steven Hayes'],
          yearDeveloped: 1990,
          applications: [
            'Individual Therapy',
            'Group Therapy',
            'Workplace Interventions',
            'Health Psychology',
          ],
        },
      ]

      setFrameworks(demoFrameworks)
      setCategories([
        'Cognitive-Behavioral',
        'Mindfulness-Based',
        'Psychodynamic',
        'Humanistic',
      ])
      if (demoFrameworks.length > 0) {
        setSelectedFramework(demoFrameworks[0] || null)
      }
    } finally {
      setLoading(false)
    }
  }

  const getUniqueConditions = () => {
    const allConditions = frameworks.flatMap((fw) => fw.conditions)
    return Array.from(new Set(allConditions)).sort()
  }

  const getEvidenceBadgeColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'strong':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'emerging':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className='mx-auto w-full max-w-7xl space-y-6 p-6'>
      {/* Header */}
      <div className='space-y-4 text-center'>
        <h1 className='text-gray-900 flex items-center justify-center gap-3 text-3xl font-bold'>
          <BookOpen className='text-blue-600 h-8 w-8' />
          Psychology Frameworks Browser
        </h1>
        <p className='text-gray-600 mx-auto max-w-2xl'>
          Explore evidence-based therapeutic frameworks with detailed
          information about techniques, applications, and clinical evidence.
          Perfect for training, research, and clinical practice.
        </p>
      </div>

      {/* Search and Filters */}
      <Card className='border-gray-200'>
        <CardContent className='p-6'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
            {/* Search */}
            <div className='relative md:col-span-2'>
              <Search className='text-gray-400 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform' />
              <Input
                placeholder='Search frameworks, techniques, conditions...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-10'
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className='border-gray-300 focus:ring-blue-500 focus:border-transparent rounded-md border px-3 py-2 focus:ring-2'
            >
              <option value='all'>All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            {/* Condition Filter */}
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className='border-gray-300 focus:ring-blue-500 focus:border-transparent rounded-md border px-3 py-2 focus:ring-2'
            >
              <option value='all'>All Conditions</option>
              {getUniqueConditions().map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </select>
          </div>

          <div className='text-gray-600 mt-4 text-sm'>
            Showing {filteredFrameworks.length} of {frameworks.length}{' '}
            frameworks
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className='flex items-center justify-center py-12'>
          <div className='border-blue-600 border-t-transparent h-8 w-8 animate-spin rounded-full border-4'></div>
          <span className='text-gray-600 ml-3'>Loading frameworks...</span>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          {/* Frameworks List */}
          <div className='space-y-3 lg:col-span-1'>
            <h2 className='text-gray-900 flex items-center gap-2 text-lg font-semibold'>
              <Brain className='h-5 w-5' />
              Frameworks ({filteredFrameworks.length})
            </h2>

            <div className='max-h-96 space-y-2 overflow-y-auto'>
              {filteredFrameworks.map((framework) => (
                <Card
                  key={framework.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedFramework?.id === framework.id
                      ? 'ring-blue-500 bg-blue-50 ring-2'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedFramework(framework)}
                >
                  <CardContent className='p-4'>
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <h3 className='text-gray-900 text-sm font-medium'>
                          {framework.name}
                        </h3>
                        <p className='text-gray-600 mt-1 text-xs'>
                          {framework.category}
                        </p>
                      </div>
                      <div className='flex flex-col items-end gap-1'>
                        <Badge
                          variant='outline'
                          className={`text-xs ${getEvidenceBadgeColor(framework.evidenceLevel)}`}
                        >
                          {framework.evidenceLevel}
                        </Badge>
                        <ChevronRight className='text-gray-400 h-4 w-4' />
                      </div>
                    </div>
                    <p className='text-gray-600 mt-2 line-clamp-2 text-xs'>
                      {framework.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Framework Details */}
          <div className='lg:col-span-2'>
            {selectedFramework ? (
              <Card className='h-full'>
                <CardHeader>
                  <div className='flex items-start justify-between'>
                    <div>
                      <CardTitle className='text-gray-900 text-xl'>
                        {selectedFramework.name}
                      </CardTitle>
                      <p className='text-gray-600 mt-1'>
                        {selectedFramework.category}
                      </p>
                    </div>
                    <Badge
                      variant='outline'
                      className={getEvidenceBadgeColor(
                        selectedFramework.evidenceLevel,
                      )}
                    >
                      {selectedFramework.evidenceLevel} Evidence
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className='space-y-6'>
                  <Tabs defaultValue='overview' className='w-full'>
                    <TabsList className='grid w-full grid-cols-4'>
                      <TabsTrigger value='overview'>Overview</TabsTrigger>
                      <TabsTrigger value='techniques'>Techniques</TabsTrigger>
                      <TabsTrigger value='applications'>
                        Applications
                      </TabsTrigger>
                      <TabsTrigger value='details'>Details</TabsTrigger>
                    </TabsList>

                    <TabsContent value='overview' className='mt-6 space-y-4'>
                      <div>
                        <h4 className='text-gray-900 mb-2 font-medium'>
                          Description
                        </h4>
                        <p className='text-gray-700'>
                          {selectedFramework.description}
                        </p>
                      </div>

                      <div>
                        <h4 className='text-gray-900 mb-2 font-medium'>
                          Key Principles
                        </h4>
                        <ul className='space-y-1'>
                          {selectedFramework.keyPrinciples.map((principle) => (
                            <li
                              key={principle}
                              className='text-gray-700 flex items-start gap-2'
                            >
                              <Target className='text-blue-600 mt-0.5 h-4 w-4 flex-shrink-0' />
                              {principle}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className='text-gray-900 mb-2 font-medium'>
                          Primary Conditions
                        </h4>
                        <div className='flex flex-wrap gap-2'>
                          {selectedFramework.conditions.map((condition) => (
                            <Badge
                              key={condition}
                              variant='outline'
                              className='text-xs'
                            >
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value='techniques' className='mt-6 space-y-4'>
                      <div>
                        <h4 className='text-gray-900 mb-3 font-medium'>
                          Core Techniques
                        </h4>
                        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                          {selectedFramework.techniques.map((technique) => (
                            <div
                              key={technique}
                              className='bg-gray-50 rounded-lg border p-3'
                            >
                              <div className='text-gray-900 text-sm font-medium'>
                                {technique}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent
                      value='applications'
                      className='mt-6 space-y-4'
                    >
                      <div>
                        <h4 className='text-gray-900 mb-3 font-medium'>
                          Clinical Applications
                        </h4>
                        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                          {selectedFramework.applications.map((application) => (
                            <div
                              key={application}
                              className='bg-blue-50 border-blue-200 rounded-lg border p-3'
                            >
                              <div className='flex items-center gap-2'>
                                <Users className='text-blue-600 h-4 w-4' />
                                <span className='text-blue-900 text-sm font-medium'>
                                  {application}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value='details' className='mt-6 space-y-4'>
                      {selectedFramework.developers && (
                        <div>
                          <h4 className='text-gray-900 mb-2 font-medium'>
                            Developers
                          </h4>
                          <p className='text-gray-700'>
                            {selectedFramework.developers.join(', ')}
                          </p>
                        </div>
                      )}

                      {selectedFramework.yearDeveloped && (
                        <div>
                          <h4 className='text-gray-900 mb-2 font-medium'>
                            Year Developed
                          </h4>
                          <p className='text-gray-700'>
                            {selectedFramework.yearDeveloped}
                          </p>
                        </div>
                      )}

                      <div>
                        <h4 className='text-gray-900 mb-2 font-medium'>
                          Evidence Level
                        </h4>
                        <Badge
                          variant='outline'
                          className={`${getEvidenceBadgeColor(selectedFramework.evidenceLevel)} text-sm`}
                        >
                          {selectedFramework.evidenceLevel} Evidence Base
                        </Badge>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card className='flex h-full items-center justify-center'>
                <CardContent className='text-center'>
                  <BookOpen className='text-gray-400 mx-auto mb-4 h-16 w-16' />
                  <h3 className='text-gray-900 mb-2 text-lg font-medium'>
                    Select a Framework
                  </h3>
                  <p className='text-gray-600'>
                    Choose a therapeutic framework from the list to view
                    detailed information
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <Card className='border-gray-200'>
        <CardContent className='p-6'>
          <div className='flex flex-wrap justify-center gap-4'>
            <Button
              variant='outline'
              onClick={loadFrameworks}
              disabled={loading}
              className='flex items-center gap-2'
            >
              <Brain className='h-4 w-4' />
              Refresh Frameworks
            </Button>
            <Button
              variant='outline'
              onClick={() => {
                setSearchTerm('')
                setSelectedCategory('all')
                setSelectedCondition('all')
              }}
              className='flex items-center gap-2'
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
