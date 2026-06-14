import { Outlet, Link, useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import Navbar from './ui/navbar'
import LoginNavButton from './ui/LoginNavButton'
import MobileTabBar from './ui/MobileTabBar'
import BrandLogo from './ui/BrandLogo'
import ToastStack from './ui/ToastStack'
import NotificationPanel from './notifications/NotificationPanel'
import { useTheme } from '@/hooks/useTheme'
import ChatWidget from './chat/ChatWidget'

const PAGE_META = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Your financial overview.' },
  '/wallet': { title: 'Wallet', subtitle: 'Manage your cards and balances.' },
  '/admin': { title: 'Overview', subtitle: 'Monitor users, cards, and platform activity.' },
  '/admin/users': { title: 'Users', subtitle: 'Search accounts, review access, and manage roles or status.' },
  '/admin/transactions': { title: 'Transactions', subtitle: 'Every transaction across the platform, with filters and sorting.' },
  '/payments': { title: 'Transaction History', subtitle: 'All payments, transfers, and refunds on your account.' },
  '/settings': { title: 'Settings', subtitle: 'Configure your preferences.' },
  '/support/users': { title: 'Users', subtitle: 'Manage user accounts and card access.' },
  '/support/tickets': { title: 'Refund Tickets', subtitle: 'Review and resolve pending refund requests.' },
}

export default function Layout() {
  const location = useLocation()
  const isLanding = location.pathname === '/'
  const pageMeta = PAGE_META[location.pathname]
  const { isDark, toggle } = useTheme()

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      {!isLanding && (
        <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:flex flex-col h-screen sticky top-0">
          <div className="flex h-[85px] items-center border-b border-sidebar-border/70 px-5">
            <Link
              to="/"
              className="flex min-w-0 items-center text-sidebar-foreground"
            >
              <BrandLogo className="h-10 w-auto shrink-0" />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto px-3.5 py-5">
            <Navbar />
          </div>
        </aside>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 md:gap-4 md:px-8 md:py-4">
            <div className="flex min-w-0 flex-col justify-center leading-tight">
              {pageMeta ? (
                <>
                  <h1 className="truncate text-xl font-bold tracking-tight text-foreground md:text-2xl">
                    {pageMeta.title}
                  </h1>
                  {pageMeta.subtitle && (
                    <p className="hidden truncate text-sm text-muted-foreground sm:block">{pageMeta.subtitle}</p>
                  )}
                </>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1 md:gap-2">
              <button
                onClick={toggle}
                className="nav-pill flex h-11 w-11 items-center justify-center rounded-input text-muted-foreground hover:bg-muted/60 hover:text-foreground touch-manipulation md:h-auto md:w-auto md:p-2"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-4.5 w-4.5" strokeWidth={2} /> : <Moon className="h-4.5 w-4.5" strokeWidth={2} />}
              </button>
              <NotificationPanel />
              <LoginNavButton />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto overflow-x-hidden px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 md:px-8 md:py-8 md:pb-8">
          <Outlet />
        </main>

        <footer className="hidden border-t border-border/60 py-5 text-center text-xs text-muted-foreground md:block">
          © {new Date().getFullYear()} Heap. All rights reserved.
        </footer>
      </div>
      {!isLanding && <MobileTabBar />}
      <ToastStack />
      <ChatWidget />
    </div>
  )
}
