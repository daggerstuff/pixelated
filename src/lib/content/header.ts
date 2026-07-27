export const headerContent = {
  title: 'Pixelated Empathy',
  brandMeta: 'Clinical simulation platform',
  navItems: [
    { href: '/training', label: 'Training' },
    { href: '/features', label: 'Features' },
    { href: '/trust', label: 'Trust' },
    { href: '/blog', label: 'Blog' },
    { href: '/contact', label: 'Contact' },
  ],
  actions: {
    primary: { href: '/register', text: 'Start Practice' },
    secondary: { href: '/login', text: 'Sign In' },
  },
} as const
