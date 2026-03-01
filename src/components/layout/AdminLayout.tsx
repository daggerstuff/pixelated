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
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  return (
    <div className='admin-layout'>
      {/* Mobile sidebar toggle: absolutely placed top-left */}
      <button
        className='mobile-sidebar-toggle bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-700 dark:text-gray-300 fixed left-4 top-4 z-[51] flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition-all md:hidden'
        aria-label='Toggle sidebar'
        aria-controls='admin-sidebar'
        aria-expanded={sidebarOpen}
        type='button'
        onClick={() => setSidebarOpen((v) => !v)}
        style={{ display: 'block' }}
      >
        {/* Hamburger/X icon */}
        <svg className='h-7 w-7' fill='currentColor' viewBox='0 0 20 20'>
          <path
            fillRule='evenodd'
            d={
              sidebarOpen
                ? 'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                : 'M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z'
            }
            clipRule='evenodd'
          />
        </svg>
      </button>

      {/* Header would normally be added by the Astro AdminLayout */}
      <header className='bg-white dark:bg-gray-800 sticky top-0 z-30 px-6 py-4 shadow-md'>
        <div className='flex items-center justify-between'>
          <h1 className='text-xl font-semibold'>{title}</h1>
          <div className='flex items-center gap-4'>
            <div className='relative'>
              <button className='text-gray-700 dark:text-gray-300 flex items-center gap-2'>
                <img
                  className='h-8 w-8 rounded-full object-cover'
                  src='https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff'
                  alt='Admin'
                />
                <span className='hidden md:inline'>Admin</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        id='admin-sidebar'
        className={`sidebar dashboard-sidebar bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 fixed left-0 top-0 z-40 h-screen w-64 border-r transition-transform ${sidebarOpen ? 'expanded translate-x-0' : '-translate-x-full'} md:expanded md:translate-x-0`}
        aria-label='Admin sidebar'
        aria-hidden={sidebarOpen ? 'false' : 'true'}
      >
        <div className='h-full overflow-y-auto px-3 py-4'>
          {/* Logo */}
          <div className='mb-5 flex items-center p-2'>
            <h2 className='text-gray-800 dark:text-white text-xl font-semibold'>
              Admin Portal
            </h2>
          </div>

          {/* Navigation */}
          <ul className='space-y-2 font-medium'>
            <li>
              <a
                href='/admin'
                className='text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center rounded-lg p-2'
              >
                <span className='ms-3'>Dashboard</span>
              </a>
            </li>
            <li>
              <a
                href='/admin/users'
                className='text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center rounded-lg p-2'
              >
                <span className='ms-3'>Users</span>
              </a>
            </li>
            <li>
              <a
                href='/admin/ai-performance'
                className='text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center rounded-lg p-2'
              >
                <span className='ms-3'>AI Performance</span>
              </a>
            </li>
            <li>
              <a
                href='/admin/security-dashboard'
                className='text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center rounded-lg p-2'
              >
                <span className='ms-3'>Security</span>
              </a>
            </li>
            <li>
              <a
                href='/admin/dlp'
                className='text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center rounded-lg p-2'
              >
                <span className='ms-3'>DLP Rules</span>
              </a>
            </li>
            <li>
              <a
                href='/admin/backup-security'
                className='text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center rounded-lg p-2'
              >
                <span className='ms-3'>Backup Security</span>
              </a>
            </li>
            <li>
              <a
                href='/admin/audit-logs'
                className='text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center rounded-lg p-2'
              >
                <span className='ms-3'>Audit Logs</span>
              </a>
            </li>
            <li>
              <a
                href='/admin/settings'
                className='text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center rounded-lg p-2'
              >
                <span className='ms-3'>Settings</span>
              </a>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main content */}
      <div className='w-full p-4 pt-20 md:ml-64'>
        <div className='border-gray-200 dark:border-gray-700 rounded-lg border-2 border-dashed p-4'>
          {children}
        </div>
        {/* Overlay for sidebar on mobile */}
        {sidebarOpen && (
          <button
            type='button'
            className='bg-black/40 fixed inset-0 z-30 backdrop-blur-sm md:hidden'
            onClick={() => setSidebarOpen(false)}
            aria-label='Close sidebar overlay'
            tabIndex={-1}
          />
        )}
      </div>
    </div>
  )
}

export default AdminLayout
