#!/usr/bin/env node

/**
 * Quick test script to verify the contact form API functionality
 */

import fetch from 'node-fetch'

const API_URL = 'http://localhost:4321/api/contact'

// Test data
const validTestData = {
  name: 'Test User',
  email: 'test@example.com',
  subject: 'API Test',
  message:
    'This is a test message to verify the contact form API is working correctly.',
}

const invalidTestData = {
  name: 'T', // Too short
  email: 'invalid-email', // Invalid format
  subject: 'Hi', // Too short
  message: 'Short', // Too short
}

const spamTestData = {
  name: 'Spam User',
  email: 'spam@example.com',
  subject: 'Special Offer',
  message: 'Buy viagra now! Click here for casino wins! Limited time offer!',
}

async function testContactAPI() {
  console.log('🚀 Testing Contact Form API...\n')

  // Test 1: Valid submission
  console.log('📧 Test 1: Valid submission')
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validTestData),
    })

    const result = await response.json()
    console.log(`Status: ${response.status}`)
    console.log(`Response:`, result)

    if (result.success) {
      console.log('✅ Valid submission test passed')
    } else {
      console.log('❌ Valid submission test failed')
    }
  } catch (error) {
    console.log('❌ Valid submission test failed with error:', error.message)
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Test 2: Invalid submission
  console.log('📧 Test 2: Invalid submission')
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidTestData),
    })

    const result = await response.json()
    console.log(`Status: ${response.status}`)
    console.log(`Response:`, result)

    if (!result.success && response.status === 400) {
      console.log('✅ Invalid submission test passed (correctly rejected)')
    } else {
      console.log(
        '❌ Invalid submission test failed (should have been rejected)',
      )
    }
  } catch (error) {
    console.log('❌ Invalid submission test failed with error:', error.message)
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Test 3: Spam detection
  console.log('📧 Test 3: Spam detection')
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(spamTestData),
    })

    const result = await response.json()
    console.log(`Status: ${response.status}`)
    console.log(`Response:`, result)

    if (!result.success && result.message.includes('security')) {
      console.log('✅ Spam detection test passed (correctly blocked)')
    } else {
      console.log('❌ Spam detection test failed (should have been blocked)')
    }
  } catch (error) {
    console.log('❌ Spam detection test failed with error:', error.message)
  }

  console.log('\n' + '='.repeat(50) + '\n')
  console.log('🏁 Contact API testing completed')
}

// Only run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testContactAPI().catch(console.error)
}
