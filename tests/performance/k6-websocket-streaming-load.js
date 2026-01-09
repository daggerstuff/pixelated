/**
 * K6 WebSocket Load Test for Pixel Multimodal Streaming
 * 
 * Tests the /ws/pixel-multimodal WebSocket endpoint under load
 * to validate:
 * - Connection establishment rate
 * - Message throughput
 * - Streaming latency < 50ms per chunk
 * - Concurrent connections (target: 1000)
 * - Connection stability
 * 
 * Phase 4.6: Performance Load Testing
 * 
 * Run with:
 *   k6 run tests/performance/k6-websocket-streaming-load.js
 * 
 * Run with different profiles:
 *   k6 run --vus 100 --duration 2m tests/performance/k6-websocket-streaming-load.js
 *   k6 run --vus 500 --duration 5m tests/performance/k6-websocket-streaming-load.js
 */

import ws from 'k6/ws'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter, Gauge } from 'k6/metrics'

// Custom metrics
const wsConnectionErrors = new Rate('ws_connection_errors')
const wsMessageLatency = new Trend('ws_message_latency', true)
const wsChunkLatency = new Trend('ws_chunk_latency', true)
const successfulMessages = new Counter('successful_messages')
const chunksReceived = new Counter('chunks_received')
const activeConnections = new Gauge('active_connections')
const reconnectionAttempts = new Counter('reconnection_attempts')

// Test configuration
export const options = {
    stages: [
        { duration: '30s', target: 50 },   // Ramp up to 50 connections
        { duration: '1m', target: 200 },   // Increase to 200
        { duration: '2m', target: 500 },   // Steady at 500
        { duration: '1m', target: 1000 },  // Peak at 1000 concurrent
        { duration: '30s', target: 0 },    // Ramp down
    ],

    thresholds: {
        ws_connection_errors: ['rate<0.05'], // <5% connection failures
        ws_message_latency: [
            'p(50)<100',   // Median < 100ms
            'p(95)<500',   // 95th percentile < 500ms
        ],
        ws_chunk_latency: [
            'p(50)<50',    // Median chunk latency < 50ms
            'p(95)<200',   // 95th percentile < 200ms
        ],
    },
}

// WebSocket configuration
const WS_URL = __ENV.WS_URL || 'ws://localhost:5173/ws/pixel-multimodal'

// Test messages
const testMessages = [
    'I am feeling anxious about an upcoming presentation.',
    'Can you help me understand cognitive behavioral therapy?',
    'I have been struggling with insomnia lately.',
    'I feel overwhelmed by my daily responsibilities.',
    'How can I manage my stress more effectively?',
    'I am experiencing low motivation and energy.',
    'My relationships are causing me emotional distress.',
    'I need help developing better coping strategies.',
    'I feel disconnected from my usual interests and hobbies.',
    'I am worried about my mental health and well-being.',
]

function generateSessionId() {
    return `ws-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function getRandomMessage() {
    return testMessages[Math.floor(Math.random() * testMessages.length)]
}

export default function () {
    const sessionId = generateSessionId()
    const url = `${WS_URL}?sessionId=${sessionId}`

    let messageStartTime
    let connectionEstablished = false
    let chunksForCurrentMessage = 0

    const response = ws.connect(url, {}, function (socket) {
        socket.on('open', () => {
            connectionEstablished = true
            activeConnections.add(1)
            console.log(`WebSocket connected: ${sessionId}`)

            // Send initial message
            sendMessage(socket)

            // Send messages at intervals
            socket.setInterval(() => {
                sendMessage(socket)
            }, 10000) // Every 10 seconds

            // Timeout after 60 seconds
            socket.setTimeout(() => {
                console.log('WebSocket timeout, closing...')
                socket.close()
            }, 60000)
        })

        socket.on('message', (data) => {
            try {
                const message = JSON.parse(data)

                if (message.status === 'buffering') {
                    // Message received, start tracking latency
                    messageStartTime = Date.now()
                    chunksForCurrentMessage = 0
                } else if (message.status === 'chunk' || message.status === 'streaming') {
                    // Chunk received
                    const chunkLatency = Date.now() - messageStartTime
                    wsChunkLatency.add(chunkLatency)
                    chunksReceived.add(1)
                    chunksForCurrentMessage++
                } else if (message.status === 'complete') {
                    // Message complete
                    const totalLatency = Date.now() - messageStartTime
                    wsMessageLatency.add(totalLatency)
                    successfulMessages.add(1)

                    check(message, {
                        'has response': (m) => !!m.response,
                        'has emotion metrics': (m) => !!m.emotions,
                        'received chunks': () => chunksForCurrentMessage > 0,
                    })
                } else if (message.status === 'error') {
                    console.error('WebSocket error:', message.error)
                    wsConnectionErrors.add(1)
                }
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e, data)
            }
        })

        socket.on('close', () => {
            activeConnections.add(-1)
            console.log(`WebSocket closed: ${sessionId}`)
        })

        socket.on('error', (e) => {
            console.error('WebSocket error:', e)
            wsConnectionErrors.add(1)
        })
    })

    check(response, {
        'WebSocket connection established': () => connectionEstablished,
    })

    if (!connectionEstablished) {
        wsConnectionErrors.add(1)
        reconnectionAttempts.add(1)

        // Exponential backoff before retry
        sleep(Math.random() * 5 + 1)
    }

    const sendMessage = (socket) => {
        const message = {
            type: 'text',
            text: getRandomMessage(),
            contextType: 'therapeutic',
        }

        messageStartTime = Date.now()
        socket.send(JSON.stringify(message))
    }
}

export function handleSummary(data) {
    return {
        'test-results/k6-websocket-summary.json': JSON.stringify(data),
        stdout: textSummary(data),
    }
}

function textSummary(data) {
    let summary = '\n'
    summary += '✅ WebSocket Streaming Load Test Results\n'
    summary += '='.repeat(50) + '\n\n'

    // Connection metrics
    summary += 'WebSocket Connection Metrics:\n'
    const connErrors = data.metrics.ws_connection_errors
    if (connErrors) {
        const errorRate = (connErrors.values.rate * 100).toFixed(2)
        summary += `  Connection Error Rate: ${errorRate}%\n`
    }

    const activeConns = data.metrics.active_connections
    if (activeConns) {
        summary += `  Peak Active Connections: ${activeConns.values.max}\n`
        summary += `  Avg Active Connections: ${activeConns.values.avg.toFixed(0)}\n`
    }
    summary += '\n'

    // Message latency
    const msgLatency = data.metrics.ws_message_latency
    if (msgLatency && msgLatency.values.count > 0) {
        summary += 'Message Latency (Complete Response):\n'
        summary += `  avg: ${msgLatency.values.avg.toFixed(2)}ms\n`
        summary += `  min: ${msgLatency.values.min.toFixed(2)}ms\n`
        summary += `  med: ${msgLatency.values.med.toFixed(2)}ms\n`
        summary += `  max: ${msgLatency.values.max.toFixed(2)}ms\n`
        summary += `  p(95): ${msgLatency.values['p(95)'].toFixed(2)}ms\n`
        summary += `  p(99): ${msgLatency.values['p(99)'].toFixed(2)}ms\n\n`
    }

    // Chunk latency
    const chunkLatency = data.metrics.ws_chunk_latency
    if (chunkLatency && chunkLatency.values.count > 0) {
        summary += 'Chunk Latency (Streaming Incremental):\n'
        summary += `  avg: ${chunkLatency.values.avg.toFixed(2)}ms\n`
        summary += `  med: ${chunkLatency.values.med.toFixed(2)}ms\n`
        summary += `  p(95): ${chunkLatency.values['p(95)'].toFixed(2)}ms\n`
        summary += `  p(99): ${chunkLatency.values['p(99)'].toFixed(2)}ms\n\n`
    }

    // Message statistics
    summary += 'Message Statistics:\n'
    if (data.metrics.successful_messages) {
        summary += `  Successful Messages: ${data.metrics.successful_messages.values.count}\n`
    }
    if (data.metrics.chunks_received) {
        summary += `  Chunks Received: ${data.metrics.chunks_received.values.count}\n`
    }
    if (data.metrics.reconnection_attempts) {
        summary += `  Reconnection Attempts: ${data.metrics.reconnection_attempts.values.count}\n`
    }
    summary += '\n'

    // Threshold results
    summary += 'Threshold Results:\n'
    const thresholds = data.metrics
    for (const [name, metric] of Object.entries(thresholds)) {
        if (metric.thresholds) {
            for (const [thresholdName, result] of Object.entries(metric.thresholds)) {
                const status = result.ok ? '✅ PASS' : '❌ FAIL'
                summary += `  ${status}: ${thresholdName}\n`
            }
        }
    }

    summary += '\n' + '='.repeat(50) + '\n'

    return summary
}
