/**
 * Configuration module exports
 *
 * This file exports all configuration modules for easier imports
 * throughout the application.
 */

import type { AuthConfig, AuthRole } from './auth.config'
import type { Env } from './env.config'

import type { RateLimitOptions } from './rate-limit.config'

// Authentication configuration
import { authConfig, hasRolePrivilege } from './auth.config'

// Deployment configuration
import deploymentConfig from './deployment.config'
// Environment variables configuration
import { config as envConfig } from './env.config'
// Rate limit configuration
import rateLimitConfig from './rate-limit.config'

// Supabase configuration
import supabaseConfig from './supabase.config'

// Theme configuration
export const SITE = {
  title: 'Pixelated Empathy',
  description:
    'Welcome to Pixelated Empathy - the premier destination for all things related to the world of AI-assisted emotional intelligence.',
  lang: 'en',
  ogImage: '/og-image.png',
  themeColor: '#8B5CF6',
}

export const UI = {
  externalLink: {
    newTab: true,
    cursorType: 'ne-resize', // options: 'ne-resize', 'pointer', etc.
  },
  navigation: {
    position: 'right', // options: 'left', 'right', 'both'
  },
  navBarLayout: {
    left: ['logoButton'],
    right: ['internalNavs', 'socialLinks', 'themeButton'],
    mergeOnMobile: true,
  },
  internalNavs: [
    {
      name: 'Blog',
      link: '/blog',
    },
    {
      name: 'Chat',
      link: '/chat',
    },
    {
      name: 'Login',
      link: '/login',
    },
  ],
  socialLinks: [
    {
      name: 'GitHub',
      link: 'https://github.com/nochadisfaction',
      icon: 'i-uil:github',
    },
    {
      name: 'Twitter',
      link: 'https://twitter.com/tweetpixelated',
      icon: 'i-uil:twitter',
    },
  ],
}

export const FEATURES = {
  slideEnterAnim: [true, { enterStep: 150 }], // [enabled, options]
  nprogress: true,
  mediumZoom: true,
}

export { type Env, envConfig }
export { supabaseConfig }
export { deploymentConfig }
export { rateLimitConfig, type RateLimitOptions }
export { authConfig, type AuthConfig, type AuthRole, hasRolePrivilege }

// Default export for all configurations
export default {
  env: envConfig,
  supabase: supabaseConfig,
  deployment: deploymentConfig,
  rateLimit: rateLimitConfig,
  auth: authConfig,
  site: SITE,
  ui: UI,
  features: FEATURES,
}
