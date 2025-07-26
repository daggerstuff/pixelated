import { z } from 'zod'

export const cdnConfigSchema = z.object({
  // Base CDN URL
  baseUrl: z.string().url(),

  // Edge locations configuration
  edgeLocations: z.array(
    z.object({
      region: z.string(),
      url: z.string().url(),
      isEnabled: z.boolean(),
    }),
  ),

  // Cache configuration
  cache: z.object({
    // Default cache duration in seconds
    defaultTtl: z.number().int().positive(),

    // Cache rules by content type
    rules: z.array(
      z.object({
        pattern: z.string(),
        ttl: z.number().int().positive(),
        isEnabled: z.boolean(),
      }),
    ),

    // Cache invalidation settings
    invalidation: z.object({
      // Whether to use soft or hard invalidation
      useSoftInvalidation: z.boolean(),
      // Patterns that trigger cache invalidation
      patterns: z.array(z.string()),
    }),

    // Cache warmup configuration
    warmup: z.object({
      isEnabled: z.boolean(),
      // URLs to warm up after deployment
      urls: z.array(z.string().url()),
    }),
  }),

  // Security headers
  security: z.object({
    // Content Security Policy
    contentSecurityPolicy: z.string(),
    // HTTP Strict Transport Security
    hstsMaxAge: z.number().int().positive(),
    // X-Content-Type-Options
    nosniff: z.boolean(),
    // X-Frame-Options
    frameOptions: z.enum(['DENY', 'SAMEORIGIN']),
    // Referrer Policy
    referrerPolicy: z.enum([
      'no-referrer',
      'no-referrer-when-downgrade',
      'origin',
      'origin-when-cross-origin',
      'same-origin',
      'strict-origin',
      'strict-origin-when-cross-origin',
      'unsafe-url',
    ]),
  }),

  // Performance optimization
  performance: z.object({
    // Enable Brotli compression
    brotli: z.boolean(),
    // Enable HTTP/3
    http3: z.boolean(),
    // Enable early hints
    earlyHints: z.boolean(),
    // Enable preload/prefetch
    resourceHints: z.boolean(),
    // Enable image optimization
    imageOptimization: z.object({
      isEnabled: z.boolean(),
      quality: z.number().min(1).max(100),
      formats: z.array(z.enum(['webp', 'avif'])),
    }),
  }),
})

export type CdnConfig = z.infer<typeof cdnConfigSchema>

export const defaultCdnConfig: CdnConfig = {
  baseUrl: 'https://cdn.pixelatedempathy.com',
  edgeLocations: [
    {
      region: 'us-east-1',
      url: 'https://us-east-1.cdn.pixelatedempathy.com',
      isEnabled: true,
    },
    {
      region: 'eu-west-1',
      url: 'https://eu-west-1.cdn.pixelatedempathy.com',
      isEnabled: true,
    },
    {
      region: 'ap-southeast-1',
      url: 'https://ap-southeast-1.cdn.pixelatedempathy.com',
      isEnabled: true,
    },
  ],
  cache: {
    defaultTtl: 86400, // 24 hours
    rules: [
      {
        pattern: '*.js',
        ttl: 604800, // 1 week
        isEnabled: true,
      },
      {
        pattern: '*.css',
        ttl: 604800, // 1 week
        isEnabled: true,
      },
      {
        pattern: '*.png|*.jpg|*.webp|*.avif',
        ttl: 2592000, // 30 days
        isEnabled: true,
      },
      {
        pattern: '*.html',
        ttl: 3600, // 1 hour
        isEnabled: true,
      },
    ],
    invalidation: {
      useSoftInvalidation: true,
      patterns: ['/*'],
    },
    warmup: {
      isEnabled: true,
      urls: [
        'https://cdn.pixelatedempathy.com/index.html',
        'https://cdn.pixelatedempathy.com/main.js',
        'https://cdn.pixelatedempathy.com/styles.css',
      ],
    },
  },
  security: {
    contentSecurityPolicy:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.pixelatedempathy.com; style-src 'self' 'unsafe-inline' https://cdn.pixelatedempathy.com; img-src 'self' data: https://cdn.pixelatedempathy.com; font-src 'self' https://cdn.pixelatedempathy.com; connect-src 'self' https://api.pixelatedempathy.com;",
    hstsMaxAge: 31536000, // 1 year
    nosniff: true,
    frameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
  },
  performance: {
    brotli: true,
    http3: true,
    earlyHints: true,
    resourceHints: true,
    imageOptimization: {
      isEnabled: true,
      quality: 85,
      formats: ['webp', 'avif'],
    },
  },
}
