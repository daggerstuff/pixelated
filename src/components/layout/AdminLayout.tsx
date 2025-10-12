import type { ReactNode, FC } from 'react'
import React from 'react'

interface AdminLayoutProps {
  title?: string
  description?: string
  children: ReactNode
}

/**
 * React wrapper for AdminLayout to maintain API consistency
 * This component allows React pages to use the same layout as Astro pages
 * by providing a bridge to the Astro AdminLayout component
 */
const AdminLayout: FC<AdminLayoutProps> = ({
  title = 'Admin Dashboard',
  children,
}: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="admin-layout">
      {/* Mobile sidebar toggle: absolutely placed top-left */}
      <button
        className="mobile-sidebar-toggle md:hidden fixed top-4 left-4 z-[51] flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-700 dark:text-gray-300 transition-all"
        aria-label="Toggle sidebar"
        aria-controls="admin-sidebar"
        aria-expanded={sidebarOpen}
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        style={{ display: 'block' }}
      >
        {/* Hamburger/X icon */}
        <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d={sidebarOpen
              ? 'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
              : 'M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z'}
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Header would normally be added by the Astro AdminLayout */}
      <header className="bg-white dark:bg-gray-800 shadow-md py-4 px-6 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{title}</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <img
                  className="h-8 w-8 rounded-full object-cover"
                  src="https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff"
                  alt="Admin"
                />
                <span className="hidden md:inline">Admin</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        className={`
          sidebar dashboard-sidebar
          fixed top-0 left-0 z-40 w-64 h-screen transition-transform bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          ${sidebarOpen ? 'translate-x-0 expanded' : '-translate-x-full'}
          md:translate-x-0 md:expanded
        `}
        aria-label="Admin sidebar"
        aria-hidden={sidebarOpen ? 'false' : 'true'}
      >
        <div className="h-full px-3 py-4 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center mb-5 p-2">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Admin Portal
            </h2>
          </div>

          {/* Navigation */}
          <ul className="space-y-2 font-medium">
            <li>
              <a
                href="/admin"
                className="flex items-center p-2 rounded-lg text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="ms-3">Dashboard</span>
              </a>
            </li>
            <li>
              <a
                href="/admin/users"
                className="flex items-center p-2 rounded-lg text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="ms-3">Users</span>
              </a>
            </li>
            <li>
              <a
                href="/admin/ai-performance"
                className="flex items-center p-2 rounded-lg text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="ms-3">AI Performance</span>
              </a>
            </li>
            <li>
              <a
                href="/admin/security-dashboard"
                className="flex items-center p-2 rounded-lg text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="ms-3">Security</span>
              </a>
            </li>
            <li>
              <a
                href="/admin/dlp"
                className="flex items-center p-2 rounded-lg text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="ms-3">DLP Rules</span>
              </a>
            </li>
            <li>
              <a
                href="/admin/backup-security"
                className="flex items-center p-2 rounded-lg text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="ms-3">Backup Security</span>
              </a>
            </li>
            <li>
              <a
                href="/admin/audit-logs"
                className="flex items-center p-2 rounded-lg text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="ms-3">Audit Logs</span>
              </a>
            </li>
            <li>
              <a
                href="/admin/settings"
                className="flex items-center p-2 rounded-lg text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span className="ms-3">Settings</span>
              </a>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main content */}
      <div className="p-4 pt-20 w-full md:ml-64">
        <div className="p-4 border-2 border-gray-200 dark:border-gray-700 border-dashed rounded-lg">
          {children}
        </div>
        {/* Overlay for sidebar on mobile */}
        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar overlay"
            tabIndex={-1}
          />
        )}
      </div>
    </div>
  )
}

export default AdminLayout
