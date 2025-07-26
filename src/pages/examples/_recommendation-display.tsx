import React, { useState } from 'react'
import RecommendationDisplay from '../../components/ai/RecommendationDisplay'
import type { EnhancedRecommendation } from '../../lib/ai/types/recommendations'

export default function RecommendationDisplayDemo() {
  const [selectedRecommendation, setSelectedRecommendation] =
    useState<EnhancedRecommendation | null>(null)
  const [showEfficacy, setShowEfficacy] = useState(true)
  const [showPersonalization, setShowPersonalization] = useState(true)
  const [showAlternatives, setShowAlternatives] = useState(false)

  const handleRecommendationSelect = (
    recommendation: EnhancedRecommendation,
  ) => {
    setSelectedRecommendation(recommendation)
  }

  return (
    <div className="recommendation-demo-container">
      <div className="demo-header">
        <h1>Enhanced Recommendation Display</h1>
        <p>
          This example demonstrates the RecommendationDisplay component with
          various configuration options.
        </p>
      </div>

      <div className="demo-controls">
        <div className="toggle-group">
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={showEfficacy}
              onChange={() => setShowEfficacy(!showEfficacy)}
            />

            <span>Show Efficacy Stats</span>
          </label>

          <label className="toggle-control">
            <input
              type="checkbox"
              checked={showPersonalization}
              onChange={() => setShowPersonalization(!showPersonalization)}
            />

            <span>Show Personalization</span>
          </label>

          <label className="toggle-control">
            <input
              type="checkbox"
              checked={showAlternatives}
              onChange={() => setShowAlternatives(!showAlternatives)}
            />

            <span>Show Alternatives</span>
          </label>
        </div>
      </div>

      <div className="demo-content">
        <RecommendationDisplay
          recommendations={mockRecommendations}
          clientName="Alex Johnson"
          onSelect={handleRecommendationSelect}
          showEfficacyStats={showEfficacy}
          showPersonalizationDetails={showPersonalization}
          showAlternatives={showAlternatives}
        />
      </div>

      {selectedRecommendation && (
        <div className="selected-recommendation">
          <h2>Selected Recommendation</h2>
          <div className="selection-data">
            <p>
              <strong>Title:</strong> {selectedRecommendation.title}
            </p>
            <p>
              <strong>ID:</strong> {selectedRecommendation.id}
            </p>
            <p>
              <strong>Selected for implementation.</strong>
            </p>
          </div>
          <button
            className="clear-selection"
            onClick={() => setSelectedRecommendation(null)}
          >
            Clear Selection
          </button>
        </div>
      )}

      <style>{`
        .recommendation-demo-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
        }

        .demo-header {
          margin-bottom: 2rem;
          text-align: center;
        }

        .demo-header h1 {
          margin-bottom: 0.5rem;
          color: var(--color-text-primary, #111827);
        }

        .demo-header p {
          color: var(--color-text-secondary, #6b7280);
          max-width: 800px;
          margin: 0 auto;
        }

        .demo-controls {
          margin-bottom: 2rem;
          padding: 1rem;
          background-color: var(--color-bg-subtle, #f9fafb);
          border-radius: 0.5rem;
          border: 1px solid var(--color-border, #e5e7eb);
        }

        .toggle-group {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
          justify-content: center;
        }

        .toggle-control {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .toggle-control input {
          cursor: pointer;
        }

        .demo-content {
          margin-bottom: 2rem;
        }

        .selected-recommendation {
          margin-top: 3rem;
          padding: 1.5rem;
          background-color: #f0f9ff;
          border-radius: 0.5rem;
          border: 1px solid #bae6fd;
        }

        .selected-recommendation h2 {
          margin-top: 0;
          margin-bottom: 1rem;
          color: #0369a1;
          font-size: 1.25rem;
        }

        .selection-data {
          margin-bottom: 1.5rem;
        }

        .clear-selection {
          background-color: #0ea5e9;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.25rem;
          cursor: pointer;
          font-size: 0.875rem;
          transition: background-color 0.2s;
        }

        .clear-selection:hover {
          background-color: #0284c7;
        }
      `}</style>

      <script
        dangerouslySetInnerHTML={{
          __html: `
          // This would be where we'd add any client-side interactivity
          // beyond what React already provides
        `,
        }}
      />
    </div>
  )
}

// Mock data for demonstration
const mockRecommendations: EnhancedRecommendation[] = [
  {
    id: 'rec-001',
    title: 'Mindfulness-Based Stress Reduction (MBSR)',
    description:
      'A structured 8-week program that combines mindfulness meditation and yoga to help reduce stress and improve mental well-being.',
    tags: ['Stress Management', 'Meditation', 'Evidence-Based'],
    timeCommitment: '45 minutes daily, 8 weeks',
    difficulty: 'Moderate',
    practiceFrequency: 'Daily',
    efficacyScore: 85,
    personalizationScore: 92,
    personalizationReason:
      'Tailored to your high stress levels and interest in meditation techniques.',
    clientContextFactors: [
      'Reported high work stress',
      'Previous positive experience with guided meditation',
      'Limited time availability in evenings',
      'Preference for structured programs',
    ],

    steps: [
      'Attend weekly 2.5-hour group sessions',
      'Practice daily 45-minute guided meditations using provided audio',
      'Complete mindfulness exercises during daily activities',
      'Keep a journal of experiences and observations',
      'Attend one full-day silent retreat in week 6',
    ],

    cautions: [
      'May initially increase awareness of stress or anxiety',
      'Requires consistent daily practice for best results',
      'Not a substitute for medical treatment for clinical anxiety or depression',
    ],

    efficacyDetails: {
      averageTimeToImprovement: '3-4 weeks',
      sampleSize: 1500,
      evidenceLevel: 'Strong - Multiple Randomized Controlled Trials',
      bestFor: [
        'Chronic stress',
        'Anxiety',
        'Recurring depression',
        'Pain management',
      ],

      references: [
        'Kabat-Zinn, J. (2013). Full Catastrophe Living: Using the Wisdom of Your Body and Mind to Face Stress, Pain, and Illness.',
        'Khoury, B., et al. (2013). Mindfulness-based therapy: A comprehensive meta-analysis.',
        'Goldberg, S.B., et al. (2018). Mindfulness-based interventions for psychiatric disorders: A systematic review and meta-analysis.',
      ],
    },
    mediaResources: [
      {
        id: 'media-001',
        title: 'Introduction to MBSR',
        type: 'Video',
        url: 'https://example.com/mbsr-intro',
        durationMinutes: 12,
        previewImage:
          'https://images.unsplash.com/photo-1506126613408-eca07ce68773?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
        description:
          'An overview of the principles and practices of Mindfulness-Based Stress Reduction.',
      },
      {
        id: 'media-002',
        title: 'MBSR Body Scan Meditation',
        type: 'Audio',
        url: 'https://example.com/mbsr-body-scan',
        durationMinutes: 30,
        description:
          'Guided meditation focusing on body awareness and relaxation.',
      },
      {
        id: 'media-003',
        title: 'The Science Behind MBSR',
        type: 'Article',
        url: 'https://example.com/mbsr-science',
        previewImage:
          'https://images.unsplash.com/photo-1593811167562-9cef47bfc4d7?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
        description:
          'Research findings on how mindfulness meditation affects brain structure and function.',
      },
    ],

    alternatives: [
      {
        id: 'alt-001',
        name: 'Cognitive Behavioral Therapy for Stress',
        description:
          'Structured therapy focusing on identifying and changing negative thought patterns related to stress.',
        efficacyRate: 78,
        suitableFor: [
          'People who prefer analytical approaches',
          'Those with specific stress triggers',
          'Individuals with negative thought patterns',
        ],
      },
      {
        id: 'alt-002',
        name: 'Progressive Muscle Relaxation',
        description:
          'Technique involving tensing and relaxing muscle groups to reduce physical symptoms of stress.',
        efficacyRate: 65,
        suitableFor: [
          'People with physical tension',
          'Those who prefer body-focused techniques',
          'Beginners to stress management',
        ],
      },
    ],
  },
  {
    id: 'rec-002',
    title: 'Digital Detox Program',
    description:
      'A structured approach to reduce digital device usage and screen time to improve mental well-being, focus, and sleep quality.',
    tags: ['Tech Balance', 'Focus', 'Sleep Improvement'],
    timeCommitment: '2 weeks with gradual implementation',
    difficulty: 'Challenging',
    practiceFrequency: 'Daily adjustments',
    efficacyScore: 72,
    personalizationScore: 88,
    personalizationReason:
      'Customized based on your screen time patterns and sleep issues.',
    clientContextFactors: [
      'Reports checking phone 40+ times daily',
      'Difficulty falling asleep',
      'Works in tech industry',
      'Experiences eye strain and headaches',
    ],

    steps: [
      'Conduct baseline assessment of current device usage',
      'Set up screen time monitoring apps on all devices',
      'Establish tech-free zones (bedroom, dining area)',
      'Implement 1-hour device cutoff before bedtime',
      'Schedule daily offline activities',
      'Use grayscale mode on devices to reduce dopamine triggers',
      'Gradually extend device-free periods each day',
    ],

    cautions: [
      'May initially cause anxiety or FOMO (fear of missing out)',
      'Work obligations may require modifications to the program',
      'Should be implemented gradually to increase adherence',
    ],

    efficacyDetails: {
      averageTimeToImprovement: '5-7 days for initial benefits',
      sampleSize: 450,
      evidenceLevel: 'Moderate - Observational Studies',
      bestFor: [
        'Sleep issues',
        'Attention problems',
        'Digital addiction',
        'Anxiety reduction',
      ],

      references: [
        'Hefner, D., et al. (2019). Digital stress: Perceptions of demands from information communication technologies.',
        'Wilmer, H.H., et al. (2017). Smartphones and cognition: A review of research exploring the links between mobile technology habits and cognitive functioning.',
      ],
    },
    mediaResources: [
      {
        id: 'media-004',
        title: 'The Digital Minimalism Method',
        type: 'Video',
        url: 'https://example.com/digital-minimalism',
        durationMinutes: 18,
        previewImage:
          'https://images.unsplash.com/photo-1529685530479-bf1b9c575c80?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
        description:
          'An overview of digital minimalism principles and implementation strategies.',
      },
      {
        id: 'media-005',
        title: 'Best Apps for Digital Wellbeing',
        type: 'Article',
        url: 'https://example.com/digital-wellbeing-apps',
        previewImage:
          'https://images.unsplash.com/photo-1575909812264-6902b55846ad?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
        description:
          'Recommended tools to help monitor and manage screen time and digital habits.',
      },
    ],

    alternatives: [
      {
        id: 'alt-003',
        name: 'Scheduled Tech Usage',
        description:
          'Rather than a full detox, this approach involves scheduling specific times for device usage and strictly adhering to those boundaries.',
        efficacyRate: 68,
        suitableFor: [
          'People with work requirements on devices',
          'Those who need gradual change',
          'Individuals with moderate usage patterns',
        ],
      },
      {
        id: 'alt-004',
        name: 'Content-Specific Limitation',
        description:
          'Focus on eliminating or strictly limiting specific problematic digital content (social media, news, etc.) while allowing other usage.',
        efficacyRate: 61,
        suitableFor: [
          'People with specific digital triggers',
          'Those who use devices for productive work',
          'Individuals with content-specific issues',
        ],
      },
    ],
  },
  {
    id: 'rec-003',
    title: 'Behavioral Activation for Mood Enhancement',
    description:
      'A structured approach that uses scheduled positive activities to improve mood, energy levels, and overall life satisfaction.',
    tags: ['Mood', 'Depression', 'Activity'],
    timeCommitment: '15-30 minutes daily, 4-6 weeks',
    difficulty: 'Easy',
    practiceFrequency: 'Daily',
    efficacyScore: 79,
    personalizationScore: 85,
    personalizationReason:
      'Personalized to address your reported low motivation and reduced interest in previously enjoyed activities.',
    clientContextFactors: [
      'Reports low energy and motivation',
      'Has withdrawn from social activities',
      'Enjoys outdoor activities but rarely engages',
      'Strongest mood in mornings',
    ],

    steps: [
      'Track daily mood and activity levels for one week',
      'Identify activities that previously brought enjoyment or satisfaction',
      'Create a graduated schedule of activities, starting with small, achievable tasks',
      'Schedule activities for times when energy is typically highest',
      'Record mood before and after each activity',
      'Gradually increase activity difficulty and duration',
      'Incorporate social activities by week 3',
    ],

    cautions: [
      'Initial motivation may be difficult - start very small if needed',
      'Not a replacement for clinical treatment for major depression',
      'May need adjustment during periods of very low energy',
    ],

    efficacyDetails: {
      averageTimeToImprovement: '2-3 weeks',
      sampleSize: 830,
      evidenceLevel: 'Strong - Multiple Clinical Trials',
      bestFor: [
        'Mild to moderate depression',
        'Low motivation',
        'Reduced interest or pleasure',
        'Social withdrawal',
      ],

      references: [
        'Ekers, D., et al. (2014). Behavioural activation for depression: An update of meta-analysis of effectiveness and sub group analysis.',
        'Mazzucchelli, T.G., et al. (2009). Behavioral activation treatments for depression in adults: A meta-analysis and review.',
      ],
    },
    mediaResources: [
      {
        id: 'media-006',
        title: 'Behavioral Activation Explained',
        type: 'Video',
        url: 'https://example.com/behavioral-activation',
        durationMinutes: 15,
        previewImage:
          'https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80',
        description:
          'An overview of behavioral activation principles and how they improve mood.',
      },
      {
        id: 'media-007',
        title: 'Activity Planning Worksheet',
        type: 'Other',
        url: 'https://example.com/activity-planning-worksheet',
        description:
          'Downloadable worksheet for scheduling and tracking behavioral activation activities.',
      },
    ],

    alternatives: [
      {
        id: 'alt-005',
        name: 'Pleasant Activity Scheduling',
        description:
          'A simplified approach focusing solely on scheduling enjoyable activities without the mood monitoring component.',
        efficacyRate: 65,
        suitableFor: [
          'People who prefer simplicity',
          'Those already aware of their mood patterns',
          'Individuals with mild symptoms',
        ],
      },
      {
        id: 'alt-006',
        name: 'Combined Physical Exercise Program',
        description:
          'A structured exercise regimen designed specifically to improve mood through physical activity.',
        efficacyRate: 72,
        suitableFor: [
          'People who enjoy physical activity',
          'Those who benefit from endorphin release',
          'Individuals with energy fluctuations',
        ],
      },
    ],
  },
]
