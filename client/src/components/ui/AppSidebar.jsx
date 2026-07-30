import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppSelector } from '@/store/hooks'
import { selectAuthUser } from '@/store/slices/authSlice'
import BrandLogo, { BrandMark } from '@/components/ui/BrandLogo'
import SidebarAccountProfile from '@/components/ui/SidebarAccountProfile'
import NotificationPanel from '@/components/notifications/NotificationPanel'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { MAIN_NAV_LINKS, SETTINGS_NAV_LINK, getRoleNavLinks } from './navLinks'

const ROLE_SECTION_LABEL = {
  admin: 'Management',
  support: 'Support',
}

// One place decides how every shell icon renders: 18×18, 1.8 stroke, no fill,
// dimmed until its row is active. Icons come from lucide (inline SVG,
// stroke="currentColor"), so size/weight/opacity are set here rather than at
// each call site.
function ShellIcon({ icon, active }) {
  // Assigned rather than destructured-and-renamed: ESLint's varsIgnorePattern
  // only exempts variables, so `{ icon: Icon }` reads as an unused prop.
  const Icon = icon
  return (
    <Icon
      className={`size-4.5 shrink-0 transition-opacity ${active ? 'opacity-100' : 'opacity-65'}`}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    />
  )
}

const rowBase =
  'nav-pill flex items-center gap-2.75 rounded-input px-2.5 py-2.25 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar'
const rowIdle = 'font-medium text-muted-foreground hover:bg-muted/50 hover:text-sidebar-foreground'
const rowActive = 'font-semibold bg-primary/10 text-primary'

function NavRow({ item, collapsed, count }) {
  return (
    <NavLink
      to={item.path}
      end
      title={collapsed ? item.name : undefined}
      className={({ isActive }) =>
        `${rowBase} ${isActive ? rowActive : rowIdle} ${collapsed ? 'justify-center' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          <ShellIcon icon={item.icon} active={isActive} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              {item.comingSoon && (
                <span className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Soon
                </span>
              )}
              {count != null && (
                <span className="shrink-0 text-xs font-semibold text-primary">{count}</span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  )
}

/** Icon-only square control — used inside the account card and the brand row. */
function IconButton({ icon, label, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`nav-pill flex size-7 shrink-0 items-center justify-center rounded-input text-muted-foreground hover:bg-muted/70 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      <ShellIcon icon={icon} active={false} />
    </button>
  )
}

function NavGroup({ label, collapsed, children }) {
  return (
    <section className="flex flex-col gap-1">
      {!collapsed && (
        <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
          {label}
        </p>
      )}
      {children}
    </section>
  )
}

/**
 * The app shell's persistent sidebar: brand, role-aware navigation, the utility
 * controls that used to live in the top bar (notifications, theme), and the
 * account card pinned to the bottom. Collapses to an icon rail; the active row
 * is derived from the router path by NavLink, never passed in.
 */
export default function AppSidebar({ collapsed, onToggleCollapsed }) {
  const user = useAppSelector(selectAuthUser)
  const { isDark, toggle } = useTheme()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const role = user?.role_name
  const roleLinks = getRoleNavLinks(role)
  const roleLabel = ROLE_SECTION_LABEL[role] ?? 'Staff'

  async function handleLogout() {
    setLogoutOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-6.5 border-r border-sidebar-border bg-sidebar px-3.5 py-5 md:flex">
      {/* Brand + collapse toggle */}
      <div className={`flex items-center gap-2.5 ${collapsed ? 'flex-col' : 'px-2'}`}>
        <NavLink
          to="/dashboard"
          aria-label="Heap home"
          className="flex min-w-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
          {collapsed ? (
            <BrandMark className="size-7.5 shrink-0 rounded-input object-contain" />
          ) : (
            <BrandLogo className="h-8 w-auto shrink-0" />
          )}
        </NavLink>
        <IconButton
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapsed}
          className={collapsed ? undefined : 'ml-auto'}
        />
      </div>

      {/* Navigation */}
      <nav className="flex min-h-0 flex-1 flex-col gap-6.5 overflow-y-auto">
        <NavGroup label="Main" collapsed={collapsed}>
          {MAIN_NAV_LINKS.map((item) => (
            <NavRow key={item.path} item={item} collapsed={collapsed} />
          ))}
        </NavGroup>

        {roleLinks.length > 0 && (
          <NavGroup label={roleLabel} collapsed={collapsed}>
            {roleLinks.map((item) => (
              <NavRow key={item.path} item={item} collapsed={collapsed} />
            ))}
          </NavGroup>
        )}
      </nav>

      {/* Utilities + account, pinned to the bottom. Theme and log out are
          icon-only controls living inside the account card. */}
      <div className="flex flex-col gap-1">
        <NotificationPanel variant="sidebar" collapsed={collapsed} />
        <NavRow item={SETTINGS_NAV_LINK} collapsed={collapsed} />

        <div className="pt-1">
          <SidebarAccountProfile
            user={user}
            collapsed={collapsed}
            actions={
              <>
                <IconButton
                  icon={isDark ? Sun : Moon}
                  label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                  onClick={toggle}
                />
                <IconButton
                  icon={LogOut}
                  label="Log out"
                  onClick={() => setLogoutOpen(true)}
                />
              </>
            }
          />
        </div>
      </div>

      <DialogRoot open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Log out of Heap?</DialogTitle>
            <DialogDescription>
              You'll need to sign in again to reach your wallet and transactions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Stay signed in</Button>
            </DialogClose>
            <Button onClick={handleLogout}>
              <LogOut className="size-4" /> Log out
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </aside>
  )
}
