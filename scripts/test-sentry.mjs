#!/usr/bin/env node

// Test script to verify Sentry configuration
import '../instrument.mjs'
import * as Sentry from '@sentry/node'

console.log('🧪 Testing Sentry Configuration...')

// Test 1: Check if Sentry is initialized
console.log('1. Checking Sentry initialization...')
const client = Sentry.getClient()
if (client) {
  console.log('✅ Sentry client is initialized')
  console.log(`   DSN: ${client.getOptions().dsn?.slice(0, 50)}...`)
  console.log(`   Environment: ${client.getOptions().environment}`)
  console.log(`   Release: ${client.getOptions().release}`)
} else {
  console.log('❌ Sentry client is not initialized')
  process.exit(1)
}

// Test 2: Test error capture
console.log('\n2. Testing error capture...')
try {
  throw new Error('Test error for Sentry configuration')
} catch (error) {
  const eventId = Sentry.captureException(error)
  console.log(`✅ Error captured with ID: ${eventId}`)
}

// Test 3: Test custom event
console.log('\n3. Testing custom message...')
const messageId = Sentry.captureMessage('Sentry configuration test completed successfully', 'info')
console.log(`✅ Message sent with ID: ${messageId}`)

// Test 4: Test performance monitoring
console.log('\n4. Testing performance monitoring...')
const transaction = Sentry.startTransaction({
  name: 'test-transaction',
  op: 'test'
})
Sentry.configureScope(scope => scope.setSpan(transaction))

setTimeout(() => {
  transaction.finish()
  console.log('✅ Performance transaction completed')
  
  // Flush events and exit
  console.log('\n5. Flushing events to Sentry...')
  Sentry.flush(2000).then(() => {
    console.log('✅ All events flushed to Sentry')
    console.log('\n🎉 Sentry configuration test completed successfully!')
    console.log('Check your Sentry dashboard for the test events.')
    process.exit(0)
  }).catch(err => {
    console.error('❌ Error flushing events:', err)
    process.exit(1)
  })
}, 100)
