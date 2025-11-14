import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface NavigationItem {
  name: string
  href: string
  icon: JSX.Element
  badge?: string | number
  children?: NavigationItem[]
  isExpanded?: boolean
}

interface NavigationSection {
  title: string
  items: NavigationItem[]
}

export function Sidebar() {
  const [pathname, setPathname] = useState<string>('')

  // Update pathname on client side
  useEffect(() => {
    setPathname(window.location.pathname)
  }, [])

  // Default to closed on mobile, only open by default on dashboard pages
  const isDashboardPage =
    pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/simulator') ||
    pathname?.startsWith('/analytics') ||
    pathname?.startsWith('/journal-research')

  const [isOpen, setIsOpen] = useState(isDashboardPage)
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    overview: true,
    therapy: true,
    research: true,
    account: false,
  })
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  // Update isOpen when pathname changes
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
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />

              <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
            </svg>
          ),
        },
        {
          name: 'Analytics',
          href: '/analytics',
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
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
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
            </svg>
          ),
        },
        {
          name: 'Session History',
          href: '/sessions',
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                  <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                </svg>
              ),
            },
            {
              name: 'Sessions',
              href: '/journal-research/sessions',
              icon: (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
      title: 'Account',
      items: [
        {
          name: 'Profile',
          href: '/profile',
          icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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

  // Don't render at all on non-dashboard pages on mobile
  if (
    !isDashboardPage &&
    typeof window !== 'undefined' &&
    window.innerWidth < 1024
  ) {
    return null
  }

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 z-20 w-64 h-full pt-16 pb-4 overflow-y-auto transition-transform bg-card border-r border-border',
        !isOpen ? '-translate-x-full' : '',
        'lg:translate-x-0',
      )}
    >
      <div className="px-3 py-4">
        <div className="mb-4">
          <button
            type="button"
            className="flex items-center w-full p-2 text-sm rounded-lg hover:bg-accent hover:text-accent-foreground transition duration-200 group"
            onClick={() => setIsOpen(!isOpen)}
          >
            <svg
              className="w-5 h-5 text-muted-foreground transition duration-75 group-hover:text-foreground"
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
            <span className="ml-3">Toggle Menu</span>
          </button>
        </div>

        <div className="space-y-4">
          {navigationSections.map((section) => (
            <div key={section.title} className="space-y-2">
              <button
                onClick={() => toggleSection(section.title.toLowerCase())}
                className="flex items-center w-full px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground transition"
              >
                <span className="flex-1 text-left">{section.title}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    expandedSections[section.title.toLowerCase()]
                      ? 'rotate-180'
                      : ''
                  }`}
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
                <ul className="space-y-1 pl-2">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || (item.children && item.children.some(child => pathname === child.href))
                    const hasChildren = item.children && item.children.length > 0
                    const itemKey = `${section.title}-${item.name}`
                    const isExpanded = expandedItems[itemKey] ?? (isActive && hasChildren)
                    
                    return (
                      <li key={item.name}>
                        <div>
                          <a
                            href={item.href}
                            className={cn(
                              'flex items-center p-2 text-sm rounded-lg transition-colors duration-200',
                              isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                            )}
                            onClick={(e) => {
                              if (hasChildren) {
                                e.preventDefault()
                                setExpandedItems({
                                  ...expandedItems,
                                  [itemKey]: !isExpanded,
                                })
                              }
                            }}
                          >
                            <span
                              className={cn(
                                isActive
                                  ? 'text-primary-foreground'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {item.icon}
                            </span>
                            <span className="ml-3 flex-1">{item.name}</span>
                            {item.badge && (
                              <span className="inline-flex items-center justify-center w-5 h-5 ml-auto text-xs font-semibold text-primary-foreground bg-primary rounded-full">
                                {item.badge}
                              </span>
                            )}
                            {hasChildren && (
                              <svg
                                className={cn(
                                  'w-4 h-4 ml-2 transition-transform',
                                  isExpanded ? 'rotate-90' : '',
                                )}
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
                            <ul className="ml-4 mt-1 space-y-1 border-l border-border pl-2">
                              {item.children!.map((child) => {
                                const isChildActive = pathname === child.href
                                return (
                                  <li key={child.name}>
                                    <a
                                      href={child.href}
                                      className={cn(
                                        'flex items-center p-2 text-xs rounded-lg transition-colors duration-200',
                                        isChildActive
                                          ? 'bg-primary/20 text-primary-foreground font-medium'
                                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                      )}
                                    >
                                      <span className="text-muted-foreground">
                                        {child.icon}
                                      </span>
                                      <span className="ml-2">{child.name}</span>
                                    </a>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
