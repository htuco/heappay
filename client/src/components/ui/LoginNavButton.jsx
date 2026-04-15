import { User } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function LoginNavButton() {
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
