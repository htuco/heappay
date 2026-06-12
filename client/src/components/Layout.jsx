import { Outlet, Link, useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import Navbar from './ui/navbar'
import LoginNavButton from './ui/LoginNavButton'
import logo from '@/assets/logo.png'
import ToastStack from './ui/ToastStack'
import NotificationPanel from './notifications/NotificationPanel'
import { useTheme } from '@/hooks/useTheme'
import ChatWidget from './chat/ChatWidget'

const PAGE_META = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Your financial overview.' },
  '/wallet': { title: 'Wallet', subtitle: 'Manage your cards and balances.' },
  '/admin': { title: 'Users', subtitle: 'Manage user accounts and roles.' },
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
        <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col h-screen sticky top-0">
          <div className="flex h-[85px] items-center border-b border-sidebar-border/70 px-5">
            <Link
              to="/"
              className="flex min-w-0 items-center gap-3 text-sidebar-foreground"
            >
              <img src={logo} alt="Heap logo" className="h-8 w-auto shrink-0" />
              <span className="min-w-0">
                <span className="block text-xl font-bold leading-5 text-primary">Heap</span>
                <span className="mt-1 block truncate text-[11px] font-medium text-muted-foreground">
                  Smart finance
                </span>
              </span>
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
          <div className="flex items-center justify-between gap-4 px-8 py-4">
            <div className="flex min-w-0 flex-col justify-center leading-tight">
              {pageMeta ? (
                <>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {pageMeta.title}
                  </h1>
                  {pageMeta.subtitle && (
                    <p className="text-sm text-muted-foreground">{pageMeta.subtitle}</p>
                  )}
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggle}
                className="nav-pill p-2 rounded-input text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-4.5 w-4.5" strokeWidth={2} /> : <Moon className="h-4.5 w-4.5" strokeWidth={2} />}
              </button>
              <NotificationPanel />
              <LoginNavButton />
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 py-8 overflow-auto">
          <Outlet />
        </main>

        <footer className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
          Heap. All rights reserved.
        </footer>
      </div>
      <ToastStack />
      <ChatWidget />
    </div>
  )
}
