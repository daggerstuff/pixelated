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

// Bundle optimization plugins
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// https://astro.build/config
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://pixelatedempathy.com',
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  trailingSlash: 'ignore',

  // Optimized build configuration for production
  build: {
    format: 'directory',
    sourcemap: process.env.NODE_ENV === 'production' ? false : true,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: (id) => {
          // React ecosystem
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor';
          }
          // UI libraries
          if (id.includes('framer-motion') || id.includes('lucide-react')) {
            return 'ui-vendor';
          }
          // Utility libraries
          if (id.includes('clsx') || id.includes('date-fns') || id.includes('axios')) {
            return 'utils-vendor';
          }
          // Chart libraries
          if (id.includes('recharts') || id.includes('chart.js')) {
            return 'charts-vendor';
          }
          // 3D libraries
          if (id.includes('three') || id.includes('@react-three')) {
            return 'three-vendor';
          }
          // Node modules (keep separate for better caching)
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
        // Optimized chunk naming for better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },

  vite: {
    build: {
      sourcemap: process.env.NODE_ENV === 'production' ? false : 'hidden',
      target: 'node24',
      // Lower chunk size warning limit for production optimization
      chunkSizeWarningLimit: process.env.NODE_ENV === 'production' ? 500 : 1500,
      // Enable minification in production
      minify: process.env.NODE_ENV === 'production' ? 'terser' : false,
      terserOptions: process.env.NODE_ENV === 'production' ? {
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug']
        },
        mangle: {
          safari10: true
        }
      } : {},
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
          '@tensorflow/tfjs-node',
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
    plugins: [
      // Bundle analyzer for production builds
      ...(process.env.ANALYZE_BUNDLE === '1' ? [visualizer({
        filename: 'dist/bundle-analysis.html',
        open: true,
        gzipSize: true,
        brotliSize: true
      })] : [])
    ],
    resolve: {
      alias: {
        '~': path.resolve('./src'),
        '@': path.resolve('./src'),
        '@components': path.resolve('./src/components'),
        '@layouts': path.resolve('./src/layouts'),
        '@utils': path.resolve('./src/utils'),
        '@lib': path.resolve('./src/lib'),
      },
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
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
        '@tensorflow/tfjs-node',
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
        '@tensorflow/tfjs-node',
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
          org: process.env.SENTRY_ORG || 'pixelated-empathy-dq',
          project: process.env.SENTRY_PROJECT || 'pixel-astro',
          authToken: process.env.SENTRY_AUTH_TOKEN,
          telemetry: false,
          sourcemaps: {
            assets: ['./.astro/dist/**/*.js', './.astro/dist/**/*.mjs', './dist/**/*.js', './dist/**/*.mjs'],
            ignore: ['**/node_modules/**'],
            filesToDeleteAfterUpload: ['**/*.map', '**/*.js.map'],
          },
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