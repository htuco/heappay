import { Outlet, Link, useLocation } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import Navbar from './ui/navbar'
import LoginNavButton from './ui/LoginNavButton'
import logo from '@/assets/logo.png'
import ToastStack from './ui/ToastStack'
import NotificationPanel from './ui/NotificationPanel'
import { useTheme } from '@/hooks/useTheme'

const PAGE_META = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: 'Your financial overview.',
  },
  '/wallet': { title: 'Wallet', subtitle: 'Manage your cards and balances.' },
  '/admin': { title: 'Users', subtitle: 'Manage user accounts and roles.' },
  '/payments': { title: 'Payments', subtitle: 'View transactions and send payments.' },
  '/settings': { title: 'Settings', subtitle: 'Configure your preferences.' },
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
        <aside className="w-64 shrink-0 border-r border-border/60 bg-card flex flex-col h-screen sticky top-0">
          <div className="px-6 py-6">
            <Link
              to="/"
              className="flex items-center gap-2 text-2xl font-bold tracking-tight text-primary"
              style={{ letterSpacing: '-0.02em' }}
            >
              <img src={logo} alt="Heap logo" className="h-7 w-auto shrink-0" />
              Heap
            </Link>
          </div>
          <div className="flex-1 px-4 pb-6 overflow-y-auto">
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
                className="nav-pill p-2 rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
    </div>
  )
}
