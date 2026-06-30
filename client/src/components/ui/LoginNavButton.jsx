import { LogOut, ShieldCheck, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import UserAvatar from '@/components/ui/UserAvatar'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

export default function LoginNavButton() {
  const navigate = useNavigate()
  const { user, logout, isAdmin } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  if (user) {
    return (
      <DropdownMenuRoot>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Open profile menu"
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full shadow-md shadow-primary/25 ring-2 ring-background transition-all duration-200 hover:shadow-lg hover:shadow-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <UserAvatar user={user} className="h-10 w-10 text-sm" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={10} className="w-90 overflow-hidden rounded-panel bg-card p-0">
          {/* Brand cover gradient with decorative glow */}
          <div className="relative h-18 overflow-hidden bg-linear-to-br from-primary-light/20 via-primary/15 to-primary-dark/20">
            <div className="pointer-events-none absolute -top-16 left-8 h-40 w-48 rounded-full bg-primary/25 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 right-2 h-36 w-40 rounded-full bg-primary-light/25 blur-3xl" />
            <div className="pointer-events-none absolute top-2 right-12 h-20 w-20 rounded-full bg-primary-dark/15 blur-2xl" />
          </div>

          {/* Centered profile section, avatar overlapping banner */}
          <div className="flex flex-col items-center px-6 pb-6 text-center">
            <div className="relative -mt-9">
              {/* Decorative ring + avatar */}
              <span className="absolute inset-0 -m-1 rounded-full bg-linear-to-br from-primary-light/30 via-primary/20 to-primary-dark/30 blur-md" />
              <UserAvatar
                user={user}
                className="relative h-18 w-18 text-2xl ring-4 ring-card"
              />
              {isAdmin ? (
                <span className="absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-card p-0.5">
                  <span className="inline-flex items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-light p-1 text-primary-foreground">
                    <ShieldCheck className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-xl font-semibold text-foreground">
              Hi, {user.first_name}!
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>

            <div className="mt-5">
              <Link
                to="/settings"
                className="group relative inline-flex h-12 min-w-64 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-input border border-primary/20 bg-linear-to-r from-primary/10 to-primary-light/10 px-5 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <span className="pointer-events-none absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100" />
                <span className="relative">Manage your account</span>
                <span className="relative text-primary/60">
                  →
                </span>
              </Link>
            </div>
          </div>

          <DropdownMenuSeparator className="my-0" />

          {/* Sign out row */}
          <DropdownMenuItem
            onClick={handleLogout}
            className="mx-2 my-2 flex cursor-pointer items-center gap-3 rounded-input px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-destructive/5 hover:text-destructive focus:bg-destructive/5 focus:text-destructive"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            Sign out
          </DropdownMenuItem>

          <div className="border-t border-border/60 px-5 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              <button
                type="button"
                title="Coming soon"
                className="cursor-pointer rounded-input transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                Privacy policy
              </button>
              <span className="mx-1.5 text-border">•</span>
              <button
                type="button"
                title="Coming soon"
                className="cursor-pointer rounded-input transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                Terms of service
              </button>
            </p>
          </div>
        </DropdownMenuContent>
      </DropdownMenuRoot>
    )
  }

  return (
    <Link
      to="/login"
      aria-label="Go to login page"
      className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      <User className="h-5 w-5" />
    </Link>
  )
}
