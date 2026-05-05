import { Outlet, Link, useLocation } from 'react-router-dom'
import { Bell, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import Navbar from './ui/navbar'
import LoginNavButton from './ui/LoginNavButton'

const PAGE_META = {
  '/dashboard': {
    title: 'Dashboard',
    subtitle: "Welcome back! Here's your financial overview.",
  },
  '/wallet': { title: 'Wallet', subtitle: 'Manage your cards and balances.' },
  '/admin': { title: 'Users', subtitle: 'Manage user accounts and roles.' },
  '/settings': { title: 'Settings', subtitle: 'Configure your preferences.' },
}

export default function Layout() {
  const location = useLocation()
  const isLanding = location.pathname === '/'
  const pageMeta = PAGE_META[location.pathname]
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const theme = savedTheme || (prefersDark ? 'dark' : 'light')
    setIsDark(theme === 'dark')
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [])

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', next)
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      {!isLanding && (
        <aside className="w-64 shrink-0 border-r border-border/60 bg-card flex flex-col h-screen sticky top-0">
          <div className="px-6 py-6">
            <Link
              to="/"
              className="text-2xl font-bold tracking-tight text-primary"
              style={{ letterSpacing: '-0.02em' }}
            >
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
                    <p className="text-[15px] text-muted-foreground">{pageMeta.subtitle}</p>
                  )}
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="nav-pill p-2 rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-[18px] w-[18px]" strokeWidth={2} /> : <Moon className="h-[18px] w-[18px]" strokeWidth={2} />}
              </button>
              <button
                type="button"
                className="nav-pill relative p-2 rounded-xl text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-card" />
              </button>
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
    </div>
  )
}
