/**
 * K6 Load Test for Pixel Multimodal REST API
 * 
 * Tests the /api/ai/pixel/infer REST endpoint under load
 * to validate:
 * - Latency percentiles (P50, P95, P99) < 200ms target
 * - Throughput (requests/second)
 * - Error rate < 1%
 * - Resource utilization
 * 
 * Phase 4.6: Performance Load Testing
 * 
 * Run with:
 *   k6 run tests/performance/k6-rest-inference-load.js
 * 
 * Run with different load profiles:
 *   k6 run --vus 10 --duration 30s tests/performance/k6-rest-inference-load.js
 *   k6 run --vus 50 --duration 2m tests/performance/k6-rest-inference-load.js
 *   k6 run --vus 100 --duration 5m tests/performance/k6-rest-inference-load.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'

// Custom metrics
const errorRate = new Rate('errors')
const inferenceLatency = new Trend('inference_latency', true)
const successfulInferences = new Counter('successful_inferences')
const crisisDetections = new Counter('crisis_detections')
const biasDetections = new Counter('bias_detections')

// Test configuration
export const options = {
    // Load stages
    stages: [
        { duration: '30s', target: 10 },  // Ramp up to 10 users
        { duration: '1m', target: 25 },   // Ramp up to 25 users
        { duration: '2m', target: 50 },   // Steady state at 50 users
        { duration: '1m', target: 100 },  // Peak load at 100 users
        { duration: '30s', target: 0 },   // Ramp down
    ],

    // Thresholds (SLAs)
    thresholds: {
        http_req_duration: [
            'p(50)<200',   // 50th percentile < 200ms
            'p(95)<500',   // 95th percentile < 500ms
            'p(99)<1000',  // 99th percentile < 1s
        ],
        http_req_failed: ['rate<0.01'], // Error rate < 1%
        errors: ['rate<0.01'],
        inference_latency: [
            'p(50)<200',   // Median latency < 200ms
            'p(95)<500',   // 95th percentile < 500ms
        ],
    },

    // Summary export
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
}

// API configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:5173'
const API_ENDPOINT = `${BASE_URL}/api/ai/pixel/infer`

// Test data - realistic therapeutic messages
const testMessages = [
    'Hello, I have been feeling very anxious lately and need someone to talk to.',
    'I am struggling with depression and do not know how to cope.',
    'My work stress is overwhelming me. Can you help?',
    'I feel disconnected from my emotions and need guidance.',
    'I am experiencing panic attacks frequently. What should I do?',
    'I have trouble sleeping due to racing thoughts at night.',
    'My relationship is causing me a lot of stress and sadness.',
    'I feel like I am not good enough no matter what I do.',
    'I am having difficulty concentrating and staying motivated.',
    'I feel lonely even when I am around other people.',
    'I am worried about my future and feel uncertain about everything.',
    'I have been avoiding social situations because of anxiety.',
    'I feel overwhelmed by my responsibilities and cannot manage them.',
    'I am struggling to find meaning and purpose in my life.',
    'I have been experiencing mood swings that I cannot control.',
    // Crisis scenarios (low percentage)
    'I have been thinking about hurting myself lately.',
    'I feel like giving up on everything.',
    // Bias scenarios (very low percentage)
    'Do you think women are naturally more emotional than men?',
]

// Helper to generate random session
function generateSessionId() {
    return `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Helper to select random message
function getRandomMessage() {
    return testMessages[Math.floor(Math.random() * testMessages.length)]
}

// Helper to create request payload
function createPayload(sessionId) {
    return JSON.stringify({
        text: getRandomMessage(),
        sessionId: sessionId,
        contextType: 'therapeutic',
        streaming: false,
    })
}

// Setup function (runs once per VU)
export function setup() {
    console.log('Starting REST API load test...')
    console.log(`Target: ${API_ENDPOINT}`)

    // Health check
    const healthCheck = http.get(`${BASE_URL}/health`)
    check(healthCheck, {
        'health check passed': (r) => r.status === 200,
    })
}

// Main test function
export default function () {
    const sessionId = generateSessionId()

    const payload = createPayload(sessionId)
    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        timeout: '30s',
    }

    // Send inference request
    const startTime = Date.now()
    const response = http.post(API_ENDPOINT, payload, params)
    const duration = Date.now() - startTime

    // Record metrics
    inferenceLatency.add(duration)

    // Validate response
    const success = check(response, {
        'status is 200': (r) => r.status === 200,
        'response has body': (r) => r.body && r.body.length > 0,
        'response is JSON': (r) => {
            try {
                JSON.parse(r.body)
                return true
            } catch {
                return false
            }
        },
        'latency < 200ms': (r) => {
            const latency = r.timings.duration
            return latency < 200
        },
    })

    if (success) {
        successfulInferences.add(1)

        try {
            const body = JSON.parse(response.body)

            // Track additional metrics
            check(body, {
                'has response field': (b) => !!b.response,
                'has latency field': (b) => typeof b.latency === 'number',
                'has emotions field': (b) => !!b.emotions,
                'latency matches target': (b) => b.latency < 200,
            })

            // Track crisis detections
            if (body.crisis) {
                crisisDetections.add(1)
            }

            // Track bias detections
            if (body.biasScore && body.biasScore > 0.5) {
                biasDetections.add(1)
            }
        } catch (e) {
            console.error('Failed to parse response:', e)
            errorRate.add(1)
        }
    } else {
        errorRate.add(1)
        console.error(`Request failed: ${response.status} ${response.body}`)
    }

    // Think time (simulate realistic user behavior)
    sleep(Math.random() * 3 + 2) // 2-5 seconds between requests
}

// Teardown function
export function teardown(data) {
    console.log('Load test completed')
}

// Custom summary handler
export function handleSummary(data) {
    return {
        'test-results/k6-rest-summary.json': JSON.stringify(data),
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
    }
}

// Text summary helper
function textSummary(data, options = {}) {
    const indent = options.indent || ''
    const colors = options.enableColors

    let summary = '\n'
    summary += `${indent}✅ REST API Load Test Results\n`
    summary += `${indent}${'='.repeat(50)}\n\n`

    // Request metrics
    const httpReqDuration = data.metrics.http_req_duration
    summary += `${indent}HTTP Request Duration:\n`
    summary += `${indent}  avg: ${httpReqDuration.values.avg.toFixed(2)}ms\n`
    summary += `${indent}  min: ${httpReqDuration.values.min.toFixed(2)}ms\n`
    summary += `${indent}  med: ${httpReqDuration.values.med.toFixed(2)}ms\n`
    summary += `${indent}  max: ${httpReqDuration.values.max.toFixed(2)}ms\n`
    summary += `${indent}  p(95): ${httpReqDuration.values['p(95)'].toFixed(2)}ms\n`
    summary += `${indent}  p(99): ${httpReqDuration.values['p(99)'].toFixed(2)}ms\n\n`

    // Inference latency
    if (data.metrics.inference_latency) {
        const infLatency = data.metrics.inference_latency
        summary += `${indent}Inference Latency:\n`
        summary += `${indent}  avg: ${infLatency.values.avg.toFixed(2)}ms\n`
        summary += `${indent}  p(50): ${infLatency.values.med.toFixed(2)}ms\n`
        summary += `${indent}  p(95): ${infLatency.values['p(95)'].toFixed(2)}ms\n`
        summary += `${indent}  p(99): ${infLatency.values['p(99)'].toFixed(2)}ms\n\n`
    }

    // Success rate
    const totalRequests = data.metrics.http_reqs.values.count
    const failedRequests = data.metrics.http_req_failed.values.rate * totalRequests
    const successRate = ((1 - data.metrics.http_req_failed.values.rate) * 100).toFixed(2)

    summary += `${indent}Request Statistics:\n`
    summary += `${indent}  Total Requests: ${totalRequests}\n`
    summary += `${indent}  Failed Requests: ${failedRequests.toFixed(0)}\n`
    summary += `${indent}  Success Rate: ${successRate}%\n\n`

    // Throughput
    const duration = data.state.testRunDurationMs / 1000
    const throughput = (totalRequests / duration).toFixed(2)
    summary += `${indent}Throughput: ${throughput} req/s\n\n`

    // Custom metrics
    if (data.metrics.successful_inferences) {
        summary += `${indent}Application Metrics:\n`
        summary += `${indent}  Successful Inferences: ${data.metrics.successful_inferences.values.count}\n`

        if (data.metrics.crisis_detections) {
            summary += `${indent}  Crisis Detections: ${data.metrics.crisis_detections.values.count}\n`
        }

        if (data.metrics.bias_detections) {
            summary += `${indent}  Bias Detections: ${data.metrics.bias_detections.values.count}\n`
        }
        summary += '\n'
    }

    // Threshold results
    summary += `${indent}Threshold Results:\n`
    const thresholds = data.metrics
    for (const [name, metric] of Object.entries(thresholds)) {
        if (metric.thresholds) {
            for (const [thresholdName, result] of Object.entries(metric.thresholds)) {
                const status = result.ok ? '✅ PASS' : '❌ FAIL'
                summary += `${indent}  ${status}: ${thresholdName}\n`
            }
        }
    }

    summary += `\n${indent}${'='.repeat(50)}\n`

    return summary
}
