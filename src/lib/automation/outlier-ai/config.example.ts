/**
 * Outlier AI Configuration Example
 * 
 * Copy this file to config.ts and fill in your credentials
 */

import type { OutlierConfig } from './types'

export const config: OutlierConfig = {
  loginUrl: 'https://outlier.ai/login', // Update with actual login URL
  dashboardUrl: 'https://outlier.ai/dashboard', // Update with actual dashboard URL
  username: 'your-username@example.com', // Your Outlier AI username/email
  password: 'your-password', // Your Outlier AI password
  checkInterval: 30000, // Check for new tasks every 30 seconds
  maxConcurrentTasks: 3, // Maximum tasks to work on simultaneously
  humanLikeDelays: {
    min: 500, // Minimum delay between actions (ms)
    max: 2000, // Maximum delay between actions (ms)
  },
  retryAttempts: 3, // Number of retry attempts on failure
  qualityThreshold: 0.7, // Minimum quality score to submit (0-1)
}
