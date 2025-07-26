import type { ReactNode } from 'react'
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
const AdminLayout: React.FC<AdminLayoutProps> = ({
  title = 'Admin Dashboard',
  children,
}) => {
  return (
    <div className="admin-layout">
      {/* Header would normally be added by the Astro AdminLayout */}
      <header className="bg-white dark:bg-gray-800 shadow-md py-4 px-6 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{title}</h1>
          <div className="flex items-center gap-4">
            <button className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                ></path>
              </svg>
            </button>
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
      <aside className="fixed top-0 left-0 z-40 w-64 h-screen transition-transform bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 md:translate-x-0">
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
      <div className="p-4 md:ml-64 pt-20 w-full">
        <div className="p-4 border-2 border-gray-200 dark:border-gray-700 border-dashed rounded-lg">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AdminLayout
