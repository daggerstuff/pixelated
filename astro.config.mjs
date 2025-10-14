import path from 'node:path';
import process from 'node:process';

import react from '@astrojs/react';
import UnoCSS from '@unocss/astro';
import { defineConfig, passthroughImageService } from 'astro/config';

import icon from 'astro-icon';
import sentry from '@sentry/astro';
import spotlightjs from '@spotlightjs/astro';

import node from '@astrojs/node'

import { visualizer } from 'rollup-plugin-visualizer';

// https://astro.build/config
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://pixelatedempathy.com',
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    sourcemap: process.env.NODE_ENV === 'development' ? true : 'hidden',
  },
  vite: {
    build: {
      sourcemap: process.env.NODE_ENV === 'development' ? true : 'hidden',
      target: 'node22',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        external: [
          '@google-cloud/storage',
          '@aws-sdk/client-s3',
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-kms',
          'redis',
          'ioredis',
          'pg',
          'mysql2',
          'sqlite3',
          'better-sqlite3',
          'better-auth',
          'better-auth/adapters/mongodb',
          'better-auth/adapters/drizzle',
          'better-auth/react',
          'axios',
          'bcryptjs',
          'jsonwebtoken',
          'pdfkit',
          '@tensorflow/tfjs',
          '@tensorflow/tfjs-layers',
          'three',
          '@react-three/fiber',
          '@react-three/drei',
          'mongodb',
          'recharts',
          'chart.js'

        ],
        onwarn(warning, warn) {
          if (
            warning.code === "SOURCEMAP_ERROR" ||
            (warning.message && warning.message.includes("didn't generate a sourcemap"))
          ) {
            return
          }
          if (warning.message && (
            warning.message.includes('externalized for browser compatibility') ||
            warning.message.includes('icon "-"') ||
            warning.message.includes('failed to load icon \'-\'') ||
            warning.message.includes('Rollup failed to resolve import')
          )) {
            return
          }
          warn(warning)
        }
      }
    },
    plugins: [visualizer()],
    resolve: {
      alias: {
        '~': path.resolve('./src'),
        '@': path.resolve('./src'),
        '@components': path.resolve('./src/components'),
        '@layouts': path.resolve('./src/layouts'),
        '@utils': path.resolve('./src/utils'),
        '@lib': path.resolve('./src/lib'),
      },
      extensions: ['.astro', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
      preserveSymlinks: false,
      mainFields: ['module', 'main'],
      conditions: ['import', 'module', 'browser', 'default'],
    },
    ssr: {
      external: [
        '@google-cloud/storage',
        '@aws-sdk/client-s3',
        '@aws-sdk/client-dynamodb',
        '@aws-sdk/client-kms',
        'redis',
        'ioredis',
        'pg',
        'mysql2',
        'sqlite3',
        'better-sqlite3',
        'better-auth',
        'better-auth/adapters/mongodb',
        'better-auth/adapters/drizzle',
        'better-auth/react',
        'axios',
        'bcryptjs',
        'jsonwebtoken',
        'pdfkit',
        'sharp',
        'canvas',
        'puppeteer',
        'playwright',
        '@sentry/profiling-node',
        '@tensorflow/tfjs',
        '@tensorflow/tfjs-layers',
        'three',
        '@react-three/fiber',
        '@react-three/drei',
        'mongodb',
        'recharts',
        'chart.js'

      ],
    },
    optimizeDeps: {
      exclude: [
        '@aws-sdk/client-s3',
        '@aws-sdk/client-kms',
        'sharp',
        'canvas',
        'puppeteer',
        'playwright',
        '@sentry/profiling-node',
        'pdfkit',
        'better-auth',
        'better-auth/adapters/mongodb',
        'better-auth/adapters/drizzle',
        'better-auth/react',
        'axios',
        'bcryptjs',
        'jsonwebtoken',
        'recharts',
        'lucide-react',
        '@tensorflow/tfjs',
        '@tensorflow/tfjs-layers',
        'three',
        '@react-three/fiber',
        '@react-three/drei',
        'mongodb',
        'recharts',
        'chart.js'

      ],
    },
  },
  integrations: [
    react({
      include: ['**/react/*', '**/components/**/*'],
      experimentalReactChildren: true,
    }),

    UnoCSS({
      injectReset: true,
    }),
    icon({
      include: {
        lucide: [
          'calendar',
          'user',
          'settings',
          'heart',
          'brain',
          'shield-check',
          'info',
          'arrow-left',
          'shield',
          'user-plus'
        ]
      },
      svgdir: './src/icons',
    }),
    ...(process.env.SENTRY_DSN ? [
      sentry({
        sourceMapsUploadOptions: {
          project: "pixel-astro",
          authToken: process.env.SENTRY_AUTH_TOKEN,
        },
      }),
      ...(process.env.NODE_ENV === 'development' && process.env.SENTRY_SPOTLIGHT === '1'
        ? [spotlightjs()]
        : [])
    ] : []),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
  security: {
    checkOrigin: true,
  },
  server: {
    port: 4321,
    host: '0.0.0.0',
    watch: {
      ignored: [
        '**/ai/**',
        '**/dataset/**',
        '**/MER2025/**',
        '**/VideoChat2/**',
        '**/*.py',
        '**/*.pyc',
        '**/__pycache__/**',
        '**/venv/**',
        '**/env/**',
        '**/logs/**',
        '**/tmp/**',
        '**/temp/**'
      ]
    }
  },
  preview: {
    port: 4322,
    host: '0.0.0.0',
  },
  image: {
    service: passthroughImageService(),
    domains: ['pixelatedempathy.com', 'cdn.pixelatedempathy.com'],
  },
  redirects: {
    '/admin': '/admin/dashboard',
    '/docs': '/docs/getting-started',
  },
  devToolbar: {
    enabled: process.env.NODE_ENV === 'development',
  },
});
