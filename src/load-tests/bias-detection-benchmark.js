/**
 * Bias Detection Engine - Performance Benchmarking Suite
 *
 * This k6 script provides comprehensive load testing and performance benchmarking
 * for the bias detection engine with various scenarios and user patterns.
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend, Counter, Gauge } from 'k6/metrics'
import {
  randomString,
  randomIntBetween,
} from 'https://jslib.k6.io/k6-utils/1.2.0/index.js'

// Custom metrics for detailed performance analysis
export const errorRate = new Rate('bias_detection_errors')
export const responseTimeTrend = new Trend('bias_detection_response_time')
export const mlInferenceTime = new Trend('ml_inference_time')
export const cacheHitRate = new Rate('cache_hit_rate')
export const throughputCounter = new Counter('requests_per_second')
export const activeUsers = new Gauge('active_users')

// Test configuration options
export const options = {
  scenarios: {
    // Smoke test - basic functionality verification
    smoke_test: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' },
    },

    // Load test - normal expected load
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 }, // Ramp up
        { duration: '10m', target: 10 }, // Stay at normal load
        { duration: '2m', target: 0 }, // Ramp down
      ],
      tags: { test_type: 'load' },
    },

    // Stress test - above normal capacity
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 }, // Ramp up to stress level
        { duration: '10m', target: 20 }, // Maintain stress
        { duration: '2m', target: 50 }, // Spike to breaking point
        { duration: '5m', target: 50 }, // Hold at breaking point
        { duration: '2m', target: 0 }, // Ramp down
      ],
      tags: { test_type: 'stress' },
    },

    // Spike test - sudden traffic spikes
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '2m', target: 5 }, // Normal load
        { duration: '30s', target: 100 }, // Sudden spike
        { duration: '1m', target: 100 }, // Hold spike
        { duration: '30s', target: 5 }, // Return to normal
        { duration: '2m', target: 5 }, // Maintain normal
      ],
      tags: { test_type: 'spike' },
    },

    // Volume test - large amount of data
    volume_test: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30m',
      tags: { test_type: 'volume' },
    },

    // Endurance test - extended duration
    endurance_test: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2h',
      tags: { test_type: 'endurance' },
    },
  },

  thresholds: {
    // Response time requirements
    bias_detection_response_time: [
      'p(95)<5000', // 95% of requests should be below 5s
      'p(99)<10000', // 99% of requests should be below 10s
      'med<2000', // Median response time should be below 2s
    ],

    // Error rate requirements
    bias_detection_errors: ['rate<0.05'], // Error rate should be below 5%

    // Cache performance
    cache_hit_rate: ['rate>0.7'], // Cache hit rate should be above 70%

    // ML inference performance
    ml_inference_time: [
      'p(95)<3000', // 95% of ML inferences should be below 3s
      'med<1000', // Median ML inference time should be below 1s
    ],

    // Overall system checks
    http_req_duration: ['p(95)<8000'], // 95% of all requests below 8s
    http_req_failed: ['rate<0.02'], // HTTP error rate below 2%
  },
}

// Base configuration
const BASE_URL = globalThis.__ENV?.BASE_URL || 'http://localhost:3000'
const API_BASE = `${BASE_URL}/api/bias-detection`

// Authentication token (in real scenario, this would be dynamic)
const AUTH_TOKEN = globalThis.__ENV?.AUTH_TOKEN || 'test-token-123'

// Sample therapeutic session data for testing
const SAMPLE_SESSIONS = [
  {
    scenarioType: 'depression',
    complexity: 'beginner',
    demographics: {
      age: '25-35',
      gender: 'female',
      ethnicity: 'caucasian',
      primaryLanguage: 'english',
    },
  },
  {
    scenarioType: 'anxiety',
    complexity: 'intermediate',
    demographics: {
      age: '18-25',
      gender: 'male',
      ethnicity: 'hispanic',
      primaryLanguage: 'spanish',
    },
  },
  {
    scenarioType: 'trauma',
    complexity: 'advanced',
    demographics: {
      age: '35-45',
      gender: 'non-binary',
      ethnicity: 'african-american',
      primaryLanguage: 'english',
    },
  },
  {
    scenarioType: 'substance-abuse',
    complexity: 'intermediate',
    demographics: {
      age: '45-55',
      gender: 'male',
      ethnicity: 'asian',
      primaryLanguage: 'english',
    },
  },
]

// Generate realistic therapeutic session data
function generateSessionData(baseSession) {
  const sessionId = randomString(32, 'abcdef0123456789')
  const timestamp = new Date().toISOString()

  return {
    session: {
      sessionId: sessionId,
      timestamp: timestamp,
      participantDemographics: {
        age: baseSession.demographics.age,
        gender: baseSession.demographics.gender,
        ethnicity: baseSession.demographics.ethnicity,
        primaryLanguage: baseSession.demographics.primaryLanguage,
        socioeconomicStatus: ['low', 'middle', 'high'][randomIntBetween(0, 2)],
        education: "Bachelor's degree",
        region: 'North America',
      },
      scenario: {
        scenarioId: `scenario-${randomString(8)}`,
        type: baseSession.scenarioType,
        complexity: baseSession.complexity,
        tags: ['therapeutic', 'training', baseSession.scenarioType],
        description: `${baseSession.scenarioType} therapy training scenario`,
        learningObjectives: [
          'Demonstrate empathy',
          'Apply therapeutic techniques',
          'Recognize bias patterns',
        ],
      },
      content: {
        patientPresentation: generatePatientPresentation(
          baseSession.scenarioType,
        ),
        therapeuticInterventions: [
          'Active listening techniques',
          'Cognitive behavioral therapy methods',
          'Empathy validation',
        ],
        patientResponses: [
          'Patient showed initial resistance',
          'Gradual opening up during session',
          'Positive response to interventions',
        ],
        sessionNotes:
          'Productive session with good therapeutic rapport established.',
      },
      aiResponses: generateAIResponses(),
      expectedOutcomes: ['Improved therapeutic skills', 'Bias recognition'],
      transcripts: [],
      metadata: {
        trainingInstitution: 'Test Medical School',
        supervisorId: 'supervisor-123',
        traineeId: `trainee-${randomString(8)}`,
        sessionDuration: randomIntBetween(1800, 3600), // 30-60 minutes
        completionStatus: 'completed',
      },
    },
    options: {
      skipCache: Math.random() > 0.7, // 30% of requests skip cache
      includeExplanation: true,
    },
  }
}

function generatePatientPresentation(scenarioType) {
  const presentations = {
    'depression':
      'Patient presents with persistent low mood, fatigue, and social withdrawal for the past 6 weeks.',
    'anxiety':
      'Patient reports excessive worry, restlessness, and difficulty concentrating affecting daily activities.',
    'trauma':
      'Patient exhibits symptoms of PTSD following a recent traumatic event, including flashbacks and hypervigilance.',
    'substance-abuse':
      'Patient acknowledges problematic alcohol use impacting work and relationships.',
  }

  return (
    presentations[scenarioType] ||
    'Patient presents with general mental health concerns.'
  )
}

function generateAIResponses() {
  const responses = []
  const responseTypes = [
    'diagnostic',
    'intervention',
    'risk-assessment',
    'recommendation',
  ]

  for (let i = 0; i < randomIntBetween(2, 5); i++) {
    responses.push({
      responseId: `response-${randomString(8)}`,
      timestamp: new Date(
        Date.now() - randomIntBetween(0, 3600000),
      ).toISOString(),
      type: responseTypes[randomIntBetween(0, responseTypes.length - 1)],
      content:
        'AI-generated therapeutic response based on patient presentation.',
      confidence: Math.round((0.7 + Math.random() * 0.3) * 100) / 100, // 0.7-1.0
      modelUsed: 'bias-detection-v1.0',
      reasoning: 'Based on evidence-based therapeutic practices.',
    })
  }

  return responses
}

// Performance testing functions
export default function () {
  activeUsers.add(1)

  const baseSession =
    SAMPLE_SESSIONS[randomIntBetween(0, SAMPLE_SESSIONS.length - 1)]
  const testSession = generateSessionData(baseSession)

  group('Bias Detection Analysis', () => {
    // Test session analysis endpoint
    const startTime = Date.now()

    const response = http.post(
      `${API_BASE}/analyze`,
      JSON.stringify(testSession),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`,
        },
        tags: {
          endpoint: 'analyze',
          scenario_type: baseSession.scenarioType,
          complexity: baseSession.complexity,
        },
      },
    )

    const responseTime = Date.now() - startTime
    responseTimeTrend.add(responseTime)
    throughputCounter.add(1)

    // Check response validity
    const isSuccessful = check(response, {
      'status is 200': (r) => r.status === 200,
      'response has success field': (r) => {
        try {
          const body = JSON.parse(r.body)
          return Object.prototype.hasOwnProperty.call(body, 'success')
        } catch {
          return false
        }
      },
      'response time acceptable': () => responseTime < 10000,
      'response has analysis data': (r) => {
        try {
          const body = JSON.parse(r.body)
          return (
            body.success &&
            body.data &&
            body.data.overallBiasScore !== undefined
          )
        } catch {
          return false
        }
      },
    })

    if (!isSuccessful) {
      errorRate.add(1)
    } else {
      errorRate.add(0)

      // Extract performance metrics from response
      try {
        const body = JSON.parse(response.body)
        if (body.processingTime) {
          mlInferenceTime.add(body.processingTime)
        }
        if (body.cacheHit !== undefined) {
          cacheHitRate.add(body.cacheHit ? 1 : 0)
        }
      } catch (e) {
        console.log('Failed to parse response for metrics:', e)
      }
    }
  })

  // Test metrics endpoint periodically
  if (Math.random() < 0.1) {
    // 10% of requests test metrics endpoint
    group('Performance Metrics', () => {
      const metricsResponse = http.get(
        `${API_BASE}/metrics?timeRange=300000&format=json`,
        {
          headers: {
            Authorization: `Bearer ${AUTH_TOKEN}`,
          },
          tags: { endpoint: 'metrics' },
        },
      )

      check(metricsResponse, {
        'metrics endpoint available': (r) => r.status === 200,
        'metrics response valid': (r) => {
          try {
            const body = JSON.parse(r.body)
            return body.summary && body.timestamp
          } catch {
            return false
          }
        },
      })
    })
  }

  // Test health check endpoint
  if (Math.random() < 0.05) {
    // 5% of requests test health endpoint
    group('Health Check', () => {
      const healthResponse = http.get(`${API_BASE}/health`, {
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
        tags: { endpoint: 'health' },
      })

      check(healthResponse, {
        'health endpoint available': (r) => r.status === 200,
        'service healthy': (r) => {
          try {
            const body = JSON.parse(r.body)
            return body.status === 'healthy'
          } catch {
            return false
          }
        },
      })
    })
  }

  activeUsers.add(-1)

  // Random sleep between requests to simulate real user behavior
  sleep(randomIntBetween(1, 3))
}

// Setup function - runs once at the beginning
export function setup() {
  console.log(`Starting bias detection load tests against ${BASE_URL}`)
  console.log(`Test scenarios: ${Object.keys(options.scenarios).join(', ')}`)

  // Verify the service is available before starting tests
  const healthCheck = http.get(`${API_BASE}/health`)
  if (healthCheck.status !== 200) {
    throw new Error(`Service not available: ${healthCheck.status}`)
  }

  console.log('Service health check passed')
  return { timestamp: Date.now() }
}

// Teardown function - runs once at the end
export function teardown(data) {
  const duration = (Date.now() - data.timestamp) / 1000
  console.log(`Load test completed in ${duration} seconds`)

  // Collect final metrics
  const finalMetrics = http.get(
    `${API_BASE}/metrics?timeRange=3600000&format=json`,
    {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    },
  )

  if (finalMetrics.status === 200) {
    try {
      const metrics = JSON.parse(finalMetrics.body)
      console.log(
        'Final performance summary:',
        JSON.stringify(metrics.summary, null, 2),
      )
    } catch {
      console.log('Could not parse final metrics')
    }
  }
}

// Utility function for running specific test scenarios
export function runScenario(scenarioName) {
  const scenario = options.scenarios[scenarioName]
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioName}`)
  }

  console.log(`Running ${scenarioName} scenario`)
  // This would be called by k6 with specific scenario configuration
}
