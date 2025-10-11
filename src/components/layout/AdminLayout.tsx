import type { ReactNode, FC } from 'react'
import React from 'react'

interface AdminLayoutProps {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}

/**
 * Enhanced responsive admin layout with improved mobile experience
 * Features touch-friendly interactions, smooth animations, and better responsive behavior
 */
const AdminLayout: FC<AdminLayoutProps> = ({
  title = 'Admin Dashboard',
  children,
  className = '',
}: AdminLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  // Enhanced responsive detection
  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-close sidebar on mobile when switching to mobile view
      if (mobile && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [sidebarOpen]);

  // Prevent body scroll when mobile sidebar is open
  React.useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobile, sidebarOpen]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <div className={`admin-layout-enhanced ${className}`}>
      {/* Enhanced mobile sidebar toggle with better touch targets */}
      <button
        className={`
          mobile-sidebar-toggle
          fixed top-4 z-[51] flex items-center justify-center
          w-12 h-12 rounded-xl transition-all duration-300 ease-in-out
          bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl
          border border-gray-200 dark:border-gray-700
          text-gray-700 dark:text-gray-300
          md:hidden
          ${sidebarOpen ? 'left-4' : 'left-4'}
          active:scale-95 touch-manipulation
        `}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-controls="admin-sidebar"
        aria-expanded={sidebarOpen}
        type="button"
        onClick={toggleSidebar}
      >
        {/* Enhanced hamburger/close icon with animation */}
        <svg className="w-6 h-6 transition-transform duration-300" fill="currentColor" viewBox="0 0 20 20">
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

      {/* Enhanced responsive sidebar with better mobile behavior */}
      <aside
        id="admin-sidebar"
        className={`
          sidebar dashboard-sidebar
          fixed top-0 left-0 z-40 h-screen transition-all duration-300 ease-in-out
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          ${isMobile
            ? `w-80 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
            : 'w-64 translate-x-0'
          }
          md:w-64 md:translate-x-0
        `}
        aria-label="Admin sidebar"
        aria-hidden={isMobile ? (sidebarOpen ? 'false' : 'true') : 'false'}
      >
        <div className="h-full px-4 py-4 overflow-y-auto">
          {/* Enhanced logo section with responsive padding */}
          <div className="flex items-center justify-between mb-6 p-2">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Admin Portal
            </h2>
            {isMobile && sidebarOpen && (
              <button
                onClick={toggleSidebar}
                className="p-1 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close sidebar"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>

          {/* Enhanced navigation with better touch targets */}
          <nav aria-label="Main navigation">
            <ul className="space-y-1 font-medium">
              {[
                { href: '/admin', label: 'Dashboard', icon: '📊' },
                { href: '/admin/users', label: 'Users', icon: '👥' },
                { href: '/admin/ai-performance', label: 'AI Performance', icon: '🤖' },
                { href: '/admin/security-dashboard', label: 'Security', icon: '🔒' },
                { href: '/admin/dlp', label: 'DLP Rules', icon: '🛡️' },
                { href: '/admin/backup-security', label: 'Backup Security', icon: '💾' },
                { href: '/admin/audit-logs', label: 'Audit Logs', icon: '📋' },
                { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
              ].map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200
                      text-gray-700 dark:text-white
                      hover:bg-gray-100 dark:hover:bg-gray-700
                      hover:translate-x-1 active:scale-95
                      min-h-[48px] touch-manipulation
                    `}
                    onClick={() => isMobile && setSidebarOpen(false)}
                  >
                    <span className="text-lg" role="img" aria-hidden="true">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </aside>

      {/* Enhanced main content area with responsive margins */}
      <div className={`
        main-content transition-all duration-300 ease-in-out
        ${isMobile ? 'w-full' : 'ml-64'}
        md:ml-64
      `}>
        {/* Enhanced header with responsive spacing */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Mobile title - hidden when sidebar is present on desktop */}
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white md:hidden">
              {title}
            </h1>
            {/* Desktop title - hidden on mobile since sidebar shows it */}
            <div className="hidden md:block">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {title}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <button className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                  <img
                    className="h-8 w-8 rounded-full object-cover"
                    src="https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff"
                    alt="Admin"
                  />
                  <span className="hidden sm:inline">Admin</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content area with responsive padding */}
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Enhanced overlay for mobile sidebar with better UX */}
      {isMobile && sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden"
            onClick={toggleSidebar}
            aria-label="Close sidebar overlay"
          />
          {/* Additional swipe area for better mobile UX */}
          <div
            className="fixed inset-y-0 left-0 w-4 z-30 md:hidden"
            onClick={toggleSidebar}
            style={{ touchAction: 'pan-y' }}
          />
        </>
      )}
    </div>
  )
}

export default AdminLayout
