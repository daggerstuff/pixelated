import type { Features, Site, Ui } from './types'
import { createBuildSafeLogger } from './lib/logging/build-safe-logger'

// Initialize logger for PHI audit logging
const logger = createBuildSafeLogger('phi-audit')

export const SITE: Site = {
  name: 'Pixelated Empathy',
  website: 'https://pixelatedempathy.com',
  base: '/',
  title: 'Pixelated Empathy',
  description: 'All your base are belong to us',
  author: 'Pixelated Empathy',
  lang: 'en',
  ogLocale: 'en_US',
  imageDomains: ['cdn.bsky.app'],
  menu: {
    home: 'Home',
    blog: 'Blog',
    about: 'About',
    contact: 'Contact',
  },
}

// Log config access for HIPAA compliance
logger.info('Configuration module loaded', {
  dataType: 'system-config',
  action: 'module-load',
  component: 'config.ts',
})

export const UI: Ui = {
  internalNavs: [
    {
      path: '/dashboard',
      title: 'Dashboard',
      displayMode: 'alwaysText',
      text: 'Dashboard',
    },
    {
      path: '/blog',
      title: 'Blog',
      displayMode: 'alwaysText',
      text: 'Blog',
    },
  ],
  socialLinks: [
    {
      link: 'https://github.com/nochadisfaction',
      title: 'Cant Get No, Chadisfaction, on GitHub',
      displayMode: 'alwaysIcon',
      icon: 'i-uil-github-alt',
    },
    {
      link: 'https://twitter.com/empathypixel',
      title: 'Pixelated Empathy on Twitter',
      displayMode: 'alwaysIcon',
      icon: 'i-ri-twitter-x-fill',
    },
  ],
  nav: {
    position: 'sticky',
    glassmorphism: true,
  },
  navBarLayout: {
    left: [],
    right: [
      'internalNavs',
      'socialLinks',
      'searchButton',
      'themeButton',
      'rssLink',
    ],
    mergeOnMobile: true,
  },
  tabbedLayoutTabs: [
    { title: 'Changelog', path: '/changelog' },
    { title: 'AstroBlog', path: '/feeds' },
    { title: 'AstroStreams', path: '/streams' },
  ],
  groupView: {
    maxGroupColumns: 3,
    showGroupItemColorOnHover: true,
  },
  githubView: {
    monorepos: [
      'withastro/astro',
      'withastro/starlight',
      'lin-stephanie/astro-loaders',
    ],
    mainLogoOverrides: [
      [/starlight/, 'https://starlight.astro.build/favicon.svg'],
    ],
    subLogoMatches: [
      [/theme/, 'i-unjs-theme-colors'],
      [/github/, 'https://www.svgrepo.com/show/475654/github-color.svg'],
      [/tweet/, 'i-logos-twitter'],
    ],
  },
  externalLink: {
    newTab: false,
    cursorType: '',
    showNewTabIcon: false,
  },
  theme: {
    toggleIcon: true,
  },
}

/**
 * Configures whether to enable special features:
 *  - Set to `false` or `[false, {...}]` to disable the feature.
 *  - Set to `[true, {...}]` to enable and configure the feature.
 */
export const FEATURES: Features = {
  share: [
    true,
    {
      twitter: [true, '@empathypixel'],
      mastodon: false,
      facebook: false,
      pinterest: false,
      reddit: false,
      telegram: false,
      whatsapp: false,
      email: true,
    },
  ],
  toc: [
    true,
    {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
      displayPosition: 'right',
      displayMode: 'always',
    },
  ],
  ogImage: [
    false,
    {
      authorOrBrand: `${SITE.title}`,
      fallbackTitle: `${SITE.description}`,
      fallbackBgType: 'plum',
    },
  ],
  slideEnterAnim: [true, { enterStep: 60 }],
}
