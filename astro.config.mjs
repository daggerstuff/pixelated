import path from 'node:path';
import process from 'node:process';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import UnoCSS from '@unocss/astro';
import { defineConfig, passthroughImageService } from 'astro/config';
import expressiveCode from 'astro-expressive-code';
import icon from 'astro-icon';
import sentry from '@sentry/astro';
import markdoc from '@astrojs/markdoc';
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
  sourcemap: true,
  },
  vite: {
    build: {
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
          'pdfkit'
        ]
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
    },
    ssr: {
      external: [
        // Packages from build.rollupOptions.external
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
        'pdfkit',
        // Additional SSR-specific packages
        'sharp',
        'canvas',
        'puppeteer',
        'playwright',
        '@sentry/profiling-node'
      ],
    },
    optimizeDeps: {
      exclude: ['@aws-sdk/client-s3', '@aws-sdk/client-kms', 'sharp', 'canvas', 'puppeteer', 'playwright', '@sentry/profiling-node', 'pdfkit'],
    },
  },
  integrations: [
    expressiveCode({
      themes: ['github-dark', 'github-light'],
      styleOverrides: {
        borderRadius: '0.5rem',
      },
    }),
    react(),
    mdx({
      components: path.resolve('./mdx-components.js'),
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
    markdoc(),
    sentry({
      dsn: process.env.SENTRY_DSN,
      sourceMapsUploadOptions: {
        project: process.env.SENTRY_PROJECT || 'pixel-astro',
        org: process.env.SENTRY_ORG || 'pixelated-empathy-dq',
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
      telemetry: false,
    }),
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
    host: true,
  },
  preview: {
    port: 4322,
    host: true,
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