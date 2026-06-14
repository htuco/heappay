import { Compass } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AuthButton from '@/components/auth-ui/AuthButton'

export default function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Compass className="h-8 w-8" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        The page you’re looking for doesn’t exist or may have moved. Let’s get you back on track.
      </p>
      <div className="mt-8 w-full max-w-xs">
        <AuthButton type="button" onClick={() => navigate('/', { replace: true })}>
          Back to home
        </AuthButton>
      </div>
    </div>
  )
}
