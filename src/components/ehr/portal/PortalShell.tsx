import {
  Calendar,
  ClipboardList,
  FileText,
  MessageSquare,
  Video,
} from 'lucide-react'
import React from 'react'

import { authClient } from '@/lib/auth-client'

export interface PortalShellProps {
  children: React.ReactNode
  activeFeature?: string
}

interface NavItem {
  id: string
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/portal', icon: ClipboardList },
  {
    id: 'scheduling',
    label: 'Scheduling',
    href: '/portal/scheduling',
    icon: Calendar,
  },
  {
    id: 'messaging',
    label: 'Messaging',
    href: '/portal/messaging',
    icon: MessageSquare,
  },
  {
    id: 'homework',
    label: 'Homework',
    href: '/portal/homework',
    icon: ClipboardList,
  },
  {
    id: 'telehealth',
    label: 'Telehealth',
    href: '/portal/telehealth',
    icon: Video,
  },
  {
    id: 'statements',
    label: 'Statements',
    href: '/portal/statements',
    icon: FileText,
  },
]

export function PortalShell({ children, activeFeature }: PortalShellProps) {
  const { data: session, isPending } = authClient.useSession()

  const userName = session?.user?.fullName ?? session?.user?.email ?? 'Patient'
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row"
      style={{ background: 'var(--np-bg)', color: 'var(--np-text)' }}
    >
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 w-full lg:w-64 lg:min-h-screen lg:fixed lg:inset-y-0 z-20 border-b lg:border-b-0 lg:border-r"
        style={{
          borderColor: 'var(--np-line)',
          background: 'var(--np-surface)',
        }}
        aria-label="Portal navigation"
      >
        <div
          className="hidden lg:flex items-center gap-3 px-6 py-5 border-b"
          style={{ borderColor: 'var(--np-line)' }}
        >
          <div
            className="flex items-center justify-center w-9 h-9 rounded text-sm font-semibold"
            style={{
              background: 'var(--np-elevated)',
              color: 'var(--np-text)',
            }}
          >
            PE
          </div>
          <div className="flex flex-col">
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--np-text)' }}
            >
              Pixelated Empathy
            </span>
            <span className="text-xs" style={{ color: 'var(--np-muted)' }}>
              Client Portal
            </span>
          </div>
        </div>

        <nav className="px-3 py-4">
          <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {NAV_ITEMS.map((item) => {
              const isActive = activeFeature === item.id
              const Icon = item.icon
              return (
                <li key={item.id} className="flex-shrink-0">
                  <a
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm rounded transition-colors duration-150"
                    style={{
                      background: isActive
                        ? 'var(--np-elevated)'
                        : 'transparent',
                      color: isActive ? 'var(--np-text)' : 'var(--np-muted)',
                      fontWeight: isActive ? 600 : 400,
                    }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 lg:ml-64 flex flex-col">
        {/* Header */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b"
          style={{ background: 'var(--np-bg)', borderColor: 'var(--np-line)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="lg:hidden flex items-center justify-center w-8 h-8 rounded text-xs font-semibold"
              style={{
                background: 'var(--np-elevated)',
                color: 'var(--np-text)',
              }}
            >
              PE
            </span>
            <h1
              className="text-base sm:text-lg font-semibold"
              style={{ color: 'var(--np-text)' }}
            >
              {NAV_ITEMS.find((n) => n.id === activeFeature)?.label ??
                'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isPending ? (
              <div
                className="w-8 h-8 rounded animate-pulse"
                style={{ background: 'var(--np-elevated)' }}
              />
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded text-xs font-semibold"
                  style={{
                    background: 'var(--np-elevated)',
                    color: 'var(--np-text)',
                  }}
                >
                  {userInitial}
                </div>
                <span
                  className="hidden sm:inline text-sm"
                  style={{ color: 'var(--np-muted)' }}
                >
                  {userName}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 py-6">
          <div className="max-w-5xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  )
}
