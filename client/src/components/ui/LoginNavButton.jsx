import { LogOut, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

function getInitials(user) {
  const first = user?.first_name?.[0] ?? ''
  const last = user?.last_name?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

export default function LoginNavButton() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

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
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-foreground transition hover:bg-muted/80"
          >
            {getInitials(user)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-2">
            <p className="text-sm font-semibold text-foreground">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
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
