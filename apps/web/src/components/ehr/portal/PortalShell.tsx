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
      className="flex min-h-screen flex-col lg:flex-row"
      style={{ background: 'var(--np-bg)', color: 'var(--np-text)' }}
    >
      {/* Sidebar */}
      <aside
        className="z-20 w-full flex-shrink-0 border-b lg:fixed lg:inset-y-0 lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r"
        style={{
          borderColor: 'var(--np-line)',
          background: 'var(--np-surface)',
        }}
        aria-label="Portal navigation"
      >
        <div
          className="hidden items-center gap-3 border-b px-6 py-5 lg:flex"
          style={{ borderColor: 'var(--np-line)' }}
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded text-sm font-semibold"
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
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {NAV_ITEMS.map((item) => {
              const isActive = activeFeature === item.id
              const Icon = item.icon
              return (
                <li key={item.id} className="flex-shrink-0">
                  <a
                    href={item.href}
                    className="flex items-center gap-3 rounded px-3 py-2.5 text-sm transition-colors duration-150"
                    style={{
                      background: isActive
                        ? 'var(--np-elevated)'
                        : 'transparent',
                      color: isActive ? 'var(--np-text)' : 'var(--np-muted)',
                      fontWeight: isActive ? 600 : 400,
                    }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col lg:ml-64">
        {/* Header */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-4 sm:px-6"
          style={{ background: 'var(--np-bg)', borderColor: 'var(--np-line)' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-8 w-8 items-center justify-center rounded text-xs font-semibold lg:hidden"
              style={{
                background: 'var(--np-elevated)',
                color: 'var(--np-text)',
              }}
            >
              PE
            </span>
            <h1
              className="text-base font-semibold sm:text-lg"
              style={{ color: 'var(--np-text)' }}
            >
              {NAV_ITEMS.find((n) => n.id === activeFeature)?.label ??
                'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isPending ? (
              <div
                className="h-8 w-8 animate-pulse rounded"
                style={{ background: 'var(--np-elevated)' }}
              />
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded text-xs font-semibold"
                  style={{
                    background: 'var(--np-elevated)',
                    color: 'var(--np-text)',
                  }}
                >
                  {userInitial}
                </div>
                <span
                  className="hidden text-sm sm:inline"
                  style={{ color: 'var(--np-muted)' }}
                >
                  {userName}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
