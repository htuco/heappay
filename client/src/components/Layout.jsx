import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { PageActionSlotContext } from './ui/page-action-context'
import AppSidebar from './ui/AppSidebar'
import PageHeader from './ui/PageHeader'
import MobileTabBar from './ui/MobileTabBar'
import ToastStack from './ui/ToastStack'
import ChatWidget from './chat/ChatWidget'
import EmailVerificationBanner from './EmailVerificationBanner'
import TourProvider from '@/context/tour/TourProvider'

const SIDEBAR_COLLAPSED_KEY = 'heap.shell.sidebarCollapsed'

const PAGE_META = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Your financial overview.' },
  '/wallet': { title: 'Wallet', subtitle: 'Manage your cards and balances.' },
  '/admin': { title: 'Overview', subtitle: 'Monitor users, cards, and platform activity.' },
  '/admin/users': { title: 'Users', subtitle: 'Search accounts, review access, and manage roles or status.' },
  '/admin/transactions': { title: 'All Transactions', subtitle: 'Every transaction across the platform, with filters and sorting.' },
  '/admin/requests': { title: 'Requests', subtitle: 'Review and resolve refund and card-freeze requests.' },
  '/admin/audit-log': { title: 'Audit log', subtitle: 'Immutable record of admin actions, logins, and refund decisions.' },
  '/transactions': { title: 'Transaction History', subtitle: 'All payments, transfers, and refunds on your account.' },
  '/recurring': { title: 'Recurring Payments', subtitle: 'Manage all your recurring payments in one place.' },
  '/contacts': { title: 'Contacts', subtitle: 'People you pay often — send in two clicks, no card re-entry.' },
  '/analytics': { title: 'Analytics', subtitle: 'Spending insights and trends — under construction.' },
  '/converter': { title: 'Currency Converter', subtitle: 'Get real-time exchange rates and convert currencies instantly.' },
  '/family': { title: 'Family', subtitle: 'Link and manage dependent accounts.' },
  '/settings': { title: 'Settings', subtitle: 'Configure your preferences.' },
  '/support/users': { title: 'Users', subtitle: 'Manage user accounts and card access.' },
  '/support/tickets': { title: 'Refund Tickets', subtitle: 'Review and resolve pending refund requests.' },
}

function readCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * The app shell — sidebar rail plus the page-header band above the routed page.
 * Two columns at md+ (the sidebar width is the only variable, so it drives the
 * grid template through `--shell-sidebar`); below md the sidebar is replaced by
 * `MobileTabBar`. Hairlines only, no shadows.
 */
export default function Layout() {
  const location = useLocation()
  const pageMeta = PAGE_META[location.pathname]
  const [collapsed, setCollapsed] = useState(readCollapsed)
  // Held in state, not a ref, so the pages under <Outlet> re-render once the
  // slot node exists and can portal their primary action into it.
  const [pageActionSlot, setPageActionSlot] = useState(null)

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      } catch {
        // A blocked or full store just means the choice doesn't persist.
      }
      return next
    })
  }

  return (
    <TourProvider>
      <div
        className="min-h-screen bg-background md:grid md:grid-cols-[var(--shell-sidebar)_minmax(0,1fr)]"
        style={{ '--shell-sidebar': collapsed ? '4.75rem' : '15.5rem' }}
      >
        <AppSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

        <div className="flex min-w-0 flex-col">
          <PageHeader
            title={pageMeta?.title}
            subtitle={pageMeta?.subtitle}
            /*
              The current page's primary action portals in here. `empty:hidden`
              keeps the flex gap from opening up on pages with no action.
            */
            actions={<div className="flex items-center empty:hidden" ref={setPageActionSlot} />}
          />

          <main className="flex-1 overflow-x-hidden px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 md:px-8 md:py-8 md:pb-8">
            <EmailVerificationBanner />
            <PageActionSlotContext.Provider value={pageActionSlot}>
              <Outlet />
            </PageActionSlotContext.Provider>
          </main>

          <footer className="hidden border-t border-border py-5 text-center text-xs text-muted-foreground md:block">
            © {new Date().getFullYear()} Heap. All rights reserved.
          </footer>
        </div>

        <MobileTabBar />
        <ToastStack />
        <ChatWidget />
      </div>
    </TourProvider>
  )
}
