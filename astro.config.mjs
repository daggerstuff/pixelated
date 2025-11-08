import path from 'node:path';
import process from 'node:process';

import react from '@astrojs/react';
import UnoCSS from '@unocss/astro';
import { defineConfig, passthroughImageService } from 'astro/config';

import icon from 'astro-icon';
import sentry from '@sentry/astro';
import spotlightjs from '@spotlightjs/astro';

import node from '@astrojs/node';

import { visualizer } from 'rollup-plugin-visualizer';

// Environment variables for cleaner code
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const shouldAnalyzeBundle = process.env.ANALYZE_BUNDLE === '1';
const hasSentryDSN = !!process.env.SENTRY_DSN;
const shouldUseSpotlight = isDevelopment && process.env.SENTRY_SPOTLIGHT === '1';

// Helper function to determine chunk names for better code splitting
function getChunkName(id) {
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
  // Return null for non-vendor modules to let Rollup handle them automatically
  return null;
}

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
    sourcemap: !isProduction,
    copy: [
      {
        from: 'templates/email',
        to: 'templates/email'
      }
    ],
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: getChunkName,
        // Optimized chunk naming for better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  vite: {
    server: {
      watch: {
        ignored: [
          // Aggressive node_modules exclusion at Vite level
          (p) => typeof p === 'string' && (
            p.includes('/node_modules/') ||
            p.includes('\\node_modules\\') ||
            p.includes('/.venv/') ||
            p.includes('\\.venv\\') ||
            p.includes('/ai/') ||
            p.includes('\\ai\\')
          ),
          '**/node_modules/**',
          '/node_modules/**',
          'node_modules/**',
          './node_modules/**',
        ],
      },
    },
    build: {
      sourcemap: isProduction ? false : 'hidden',
      target: 'node24',
      chunkSizeWarningLimit: isProduction ? 500 : 1500,
      // Enable minification in production
      minify: isProduction ? 'terser' : false,
      terserOptions: isProduction ? {
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
          '@tensorflow/tfjs-layers',
          'three',
          '@react-three/fiber',
          '@react-three/drei',
          'mongodb',
          'recharts',
          'chart.js',
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
      ...(shouldAnalyzeBundle ? [visualizer({
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
        'chart.js',
      ],
    },
    optimizeDeps: {
      entries: [
        'src/**/*.{ts,tsx,js,jsx,astro}',
        'src/**/*.mjs',
      ],
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
        'chart.js',
      ],
    },
  },
  integrations: (() => {
    const MIN_DEV = process.env.MIN_DEV === '1'
    const base = [
      react({
        include: ['**/react/*', '**/components/**/*'],
        experimentalReactChildren: true,
      })
    ]
    if (MIN_DEV) return base
    return [
      ...base,
      UnoCSS({ injectReset: true }),
      icon({
        include: {
          lucide: [
            'calendar', 'user', 'settings', 'heart', 'brain', 'shield-check', 'info', 'arrow-left', 'shield', 'user-plus'
          ]
        },
        svgdir: './src/icons',
      }),
      ...(hasSentryDSN ? [
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
        ...(shouldUseSpotlight ? [spotlightjs()] : [])
      ] : []),
    ]
  })(),
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
      followSymlinks: false,
      ignored: [
        // Hard guard first: function ignore for node_modules and .venv anywhere
        (p) => typeof p === 'string' && (
          p.includes('/node_modules/') ||
          p.includes('\\node_modules\\') ||
          p.includes('/.venv/') ||
          p.includes('\\.venv\\') ||
          p.includes('/ai/') ||
          p.includes('\\ai\\')
        ),
        // Python virtual environments and cache
        '**/.venv/**',
        '.venv/**',
        '**/.uv/**',
        '.uv/**',
        '**/.python/**',
        '.python/**',
        '**/site-packages/**',
        '**/venv/**',
        'venv/**',
        '**/__pycache__/**',
        '__pycache__/**',
        '**/*.py',
        '**/*.pyc',
        '**/*.pyo',
        '**/*.pyd',
        '**/.ruff_cache/**',
        '.ruff_cache/**',
        '**/.pytest_cache/**',
        '.pytest_cache/**',
        // AI and data directories
        '/ai/**',
        '**/ai/**',
        '**/dataset/**',
        '**/MER2025/**',
        '**/VideoChat2/**',
        // Build and cache directories
        '/logs/**',
        'logs/**',
        '/tmp/**',
        'tmp/**',
        '/temp/**',
        'temp/**',
        '/coverage/**',
        'coverage/**',
        // Node modules (should already be ignored but being explicit)
        '**/node_modules/**',
        '/node_modules/**',
        'node_modules/**',
        // pnpm and Vite caches inside node_modules
        '**/node_modules/.pnpm/**',
        'node_modules/.pnpm/**',
        '**/node_modules/.vite/**',
        'node_modules/.vite/**',
        '**/node_modules/.cache/**',
        'node_modules/.cache/**',
        // miscellaneous caches
        '**/.pnpm/**',
        '.pnpm/**',
        '**/.vite/**',
        '.vite/**',
        '**/.cache/**',
        '.cache/**',
        // MCP server
        '/mcp_server/**',
        'mcp_server/**',
        '**/mcp_server/**',
        // Other ignored paths
        '/env/**',
        'env/**',
        '**/.git/**',
        '**/.DS_Store',
        '**/dist/**',
        '**/.astro/**',
        // Final guard: regex-based ignore for ai/.venv on any platform
        /\/ai\/\.venv\//,
        // Guard for any .venv path (root or nested)
        /\/.venv\//,
        /\.venv\//,
      ],
      usePolling: false,
    },
    fs: {
      strict: true,
      allow: [
        path.resolve('./src'),
        path.resolve('./public'),
        path.resolve('./.astro'),
      ],
      deny: [
        'node_modules',
        '/node_modules',
        '**/node_modules/**',
        './node_modules',
        './node_modules/**',
        'ai',
        '/ai',
        '**/ai/**',
        '.venv',
        '/.venv',
        '**/.venv/**',
      ],
    },
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
    enabled: isDevelopment,
  },
});
