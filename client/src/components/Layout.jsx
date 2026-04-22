import { Outlet, Link, useLocation } from 'react-router-dom'
import Navbar from './ui/navbar'
import LoginNavButton from './ui/LoginNavButton'

export default function Layout() {
  const location = useLocation()
  const isLanding = location.pathname === '/'

  return (
    <div className="w-screen h-screen bg-background flex flex-col gap-5 p-5">
      
      {/* Header */}
      <nav className="bg-card text-card-foreground rounded-md px-7 py-5 border border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-2xl font-bold hover:text-primary transition"
          >
            Heap
          </Link>
          <button
            onClick={() => document.documentElement.classList.toggle('dark')}
            className="ml-2 px-3 py-1 rounded-sm bg-primary text-primary-foreground text-sm"
          >
            Toggle theme
          </button>
        </div>

        <LoginNavButton />
      </nav>

      {/* Body */}
      <div className="flex flex-1 gap-5 overflow-hidden">
        
        {/* Sidebar – hidden on landing page */}
        {!isLanding && (
          <aside className="w-64 text-sidebar-foreground rounded-sm px-5 py-7 border bg-card">
            <Navbar />
          </aside>
        )}

        {/* Content area */}
        <div className="flex-1 flex flex-col gap-5 overflow-hidden">
          
          {/* Main */}
          <main className="flex-1 bg-card rounded-sm p-7 overflow-auto border">
            <Outlet />
          </main>

          {/* Footer */}
          <footer className="bg-card text-muted-foreground rounded-sm px-7 py-5 text-center text-sm border">
            © 2026 Heap. All rights reserved.
          </footer>
        </div>
      </div>
    </div>
  )
}