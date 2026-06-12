import { Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AuthButton from '@/components/auth-ui/AuthButton'
import { useAuth } from '@/hooks/useAuth'

export default function AccountSuspendedPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // logout clears local session even when the API call fails
    }
    navigate('/login?suspended=1', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Lock className="h-8 w-8" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Account suspended</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Your account has been temporarily frozen by an administrator. You cannot use Heap
        until your access is restored. Contact support if you believe this is a mistake.
      </p>
      <div className="mt-8 w-full max-w-xs">
        <AuthButton type="button" onClick={handleLogout}>
          Sign out
        </AuthButton>
      </div>
    </div>
  )
}
