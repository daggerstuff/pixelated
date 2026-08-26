import React, { useState, useEffect } from 'react'

// Minimal style helper — inline styles only, no UnoCSS/tailwind dependency
function np(classes: string): string {
  return classes
}

interface NavigationItem {
  name: string
  href: string
  icon: React.ReactNode
  badge?: string | number
  children?: NavigationItem[]
  isExpanded?: boolean
}

interface NavigationSection {
  title: string
  items: NavigationItem[]
}

// Shared style objects (zero-chroma NP tokens)
const styles = {
  sectionBtn: {
    display: 'flex',
    width: '100%',
    alignItems: 'center',
    padding: '8px 12px',
    fontFamily: '"IoskeleyMono", ui-monospace, monospace',
    fontSize: '0.6875rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    color: 'var(--np-muted)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'color 0.15s var(--np-ease)',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px',
    fontFamily: '"IoskeleyMono", ui-monospace, monospace',
    fontSize: '0.75rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    textDecoration: 'none',
    color: 'var(--np-muted)',
    background: 'transparent',
    transition: 'background 0.15s var(--np-ease), color 0.15s var(--np-ease)',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left' as const,
  },
  navLinkActive: {
    color: 'var(--np-text)',
    background: 'var(--np-elevated)',
  },
  childLink: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 12px',
    fontFamily: '"IoskeleyMono", ui-monospace, monospace',
    fontSize: '0.6875rem',
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
    textDecoration: 'none',
    color: 'var(--np-muted)',
    transition: 'background 0.15s var(--np-ease), color 0.15s var(--np-ease)',
  },
  childLinkActive: {
    color: 'var(--np-text)',
    background: 'var(--np-elevated)',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    fontFamily: '"IoskeleyMono", ui-monospace, monospace',
    fontSize: '0.625rem',
    color: 'var(--np-bg)',
    background: 'var(--np-text)',
  },
  icon: {
    width: '14px',
    height: '14px',
    flexShrink: 0,
    color: 'inherit',
  } as React.CSSProperties,
  iconWrapper: {
    width: '14px',
    height: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  } as React.CSSProperties,
}

export function Sidebar() {
  const [pathname, setPathname] = useState<string>('')

  useEffect(() => {
    setPathname(window.location.pathname)
  }, [])

  const isDashboardPage =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/simulator') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/journal-research')

  const [isOpen, setIsOpen] = useState(isDashboardPage)
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    overview: true,
    therapy: true,
    research: true,
    training: true,
    account: false,
  })
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(
    {},
  )

  useEffect(() => {
    setIsOpen(isDashboardPage)
  }, [pathname, isDashboardPage])

  const toggleSection = (section: string) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section],
    })
  }

  const navigationSections: NavigationSection[] = [
    {
      title: 'Overview',
      items: [
        {
          name: 'Dashboard',
          href: '/dashboard',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />

              <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
            </svg>
          ),
        },
        {
          name: 'Analytics',
          href: '/analytics',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          ),
        },
        {
          name: 'Agent Notes',
          href: '/dashboard/agent-notes',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h2v3.586L11.586 17H16a2 2 0 002-2V9.828a2 2 0 00-.586-1.414L15 6.586A2 2 0 0013.586 6H12V5a2 2 0 00-2-2H4zm8 2.414L14.586 8H13a1 1 0 01-1-1V4.414zM7 8h6a1 1 0 110 2H7a1 1 0 010-2zm0 4h6a1 1 0 110 2H7a1 1 0 110-2z"
                clipRule="evenodd"
              />
            </svg>
          ),
        },
        {
          name: 'Agent Monitor',
          href: '/dashboard/agent-monitor',
          icon: (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          ),
        },
        {
          name: 'Clinical Validity',
          href: '/dashboard/clinical-validity',
          icon: (
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Therapy Tools',
      items: [
        {
          name: 'Chat',
          href: '/chat',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />

              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
          ),

          badge: '3',
        },
        {
          name: 'Practice Simulator',
          href: '/simulator',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
          ),
        },
        {
          name: 'Resources',
          href: '/resources',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
          ),
        },
        {
          name: 'Session History',
          href: '/sessions',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                clipRule="evenodd"
              />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Research',
      items: [
        {
          name: 'Journal Research',
          href: '/journal-research',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path
                fillRule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clipRule="evenodd"
              />
            </svg>
          ),
          children: [
            {
              name: 'Dashboard',
              href: '/journal-research',
              icon: (
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                  <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                </svg>
              ),
            },
            {
              name: 'Sessions',
              href: '/journal-research/sessions',
              icon: (
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                    clipRule="evenodd"
                  />
                </svg>
              ),
            },
            {
              name: 'Discovery',
              href: '/journal-research/discovery',
              icon: (
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              ),
            },
            {
              name: 'Evaluation',
              href: '/journal-research/evaluation',
              icon: (
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ),
            },
            {
              name: 'Acquisition',
              href: '/journal-research/acquisition',
              icon: (
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              ),
            },
            {
              name: 'Integration',
              href: '/journal-research/integration',
              icon: (
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                    clipRule="evenodd"
                  />
                </svg>
              ),
            },
            {
              name: 'Reports',
              href: '/journal-research/reports',
              icon: (
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z"
                    clipRule="evenodd"
                  />
                </svg>
              ),
            },
          ],
        },
      ],
    },
    {
      title: 'Training',
      items: [
        {
          name: 'Training Portal',
          href: '/training',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
          ),
        },
        {
          name: 'Annotation Queue',
          href: '/training/annotation',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          name: 'Profile',
          href: '/profile',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          ),
        },
        {
          name: 'Security',
          href: '/security',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          ),
        },
        {
          name: 'Settings',
          href: '/settings',
          icon: (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
          ),
        },
      ],
    },
  ]

  if (
    !isDashboardPage &&
    typeof window !== 'undefined' &&
    window.innerWidth < 1024
  ) {
    return null
  }

  return (
    <div
      className={np('w-full h-full overflow-y-auto')}
      style={{
        background: 'transparent',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      <div style={{ padding: '16px 12px' }}>
        <div style={{ marginBottom: '16px', padding: '0 4px' }}>
          <button
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontFamily: '"IoskeleyMono", ui-monospace, monospace',
              fontSize: '0.75rem',
              letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
              color: 'var(--np-muted)',
              transition: 'color 0.15s var(--np-ease)',
            }}
            onClick={() => setIsOpen(!isOpen)}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--np-text)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--np-muted)'
            }}
          >
            <svg
              style={{ width: '14px', height: '14px', flexShrink: 0 }}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d={
                  isOpen
                    ? 'M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 6a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 6a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z'
                    : 'M4 6h16M4 12h16M4 18h16'
                }
                clipRule="evenodd"
              />
            </svg>
            <span style={{ marginLeft: '10px' }}>Toggle Menu</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navigationSections.map((section) => (
            <div key={section.title}>
              <button
                onClick={() => toggleSection(section.title.toLowerCase())}
                style={styles.sectionBtn}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--np-text)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--np-muted)'
                }}
              >
                <span style={{ flex: 1, textAlign: 'left' }}>
                  {section.title}
                </span>
                <svg
                  style={{
                    width: '12px',
                    height: '12px',
                    transition: 'transform 0.15s var(--np-ease)',
                    transform: expandedSections[section.title.toLowerCase()]
                      ? 'rotate(180deg)'
                      : 'rotate(0deg)',
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {expandedSections[section.title.toLowerCase()] && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {section.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      item.children?.some((child) => pathname === child.href)
                    const hasChildren =
                      item.children && item.children.length > 0
                    const itemKey = `${section.title}-${item.name}`
                    const isExpanded =
                      expandedItems[itemKey] ?? (isActive && hasChildren)

                    return (
                      <li key={item.name}>
                        <a
                          href={item.href}
                          style={{
                            ...styles.navLink,
                            ...(isActive ? styles.navLinkActive : {}),
                          }}
                          onClick={(e) => {
                            if (hasChildren) {
                              e.preventDefault()
                              setExpandedItems({
                                ...expandedItems,
                                [itemKey]: !isExpanded,
                              })
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background =
                                'var(--np-hover)'
                              e.currentTarget.style.color = 'var(--np-text)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = 'var(--np-muted)'
                            }
                          }}
                        >
                          <span style={styles.iconWrapper}>{item.icon}</span>
                          <span style={{ marginLeft: '10px', flex: 1 }}>
                            {item.name}
                          </span>
                          {item.badge && (
                            <span style={styles.badge}>{item.badge}</span>
                          )}
                          {hasChildren && (
                            <svg
                              style={{
                                width: '12px',
                                height: '12px',
                                marginLeft: 'auto',
                                transition: 'transform 0.15s var(--np-ease)',
                                transform: isExpanded
                                  ? 'rotate(90deg)'
                                  : 'rotate(0deg)',
                              }}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          )}
                        </a>
                        {hasChildren && isExpanded && (
                          <ul
                            style={{
                              listStyle: 'none',
                              margin: '2px 0 2px 16px',
                              padding: 0,
                              borderLeft: '1px solid var(--np-line)',
                            }}
                          >
                            {item.children!.map((child) => {
                              const isChildActive = pathname === child.href
                              return (
                                <li key={child.name}>
                                  <a
                                    href={child.href}
                                    style={{
                                      ...styles.childLink,
                                      ...(isChildActive
                                        ? styles.childLinkActive
                                        : {}),
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!isChildActive) {
                                        e.currentTarget.style.background =
                                          'var(--np-hover)'
                                        e.currentTarget.style.color =
                                          'var(--np-text)'
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!isChildActive) {
                                        e.currentTarget.style.background =
                                          'transparent'
                                        e.currentTarget.style.color =
                                          'var(--np-muted)'
                                      }
                                    }}
                                  >
                                    <span style={styles.iconWrapper}>
                                      {child.icon}
                                    </span>
                                    <span style={{ marginLeft: '8px' }}>
                                      {child.name}
                                    </span>
                                  </a>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
