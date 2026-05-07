import { AlertCircle, CheckCircle2 } from 'lucide-react'

const VARIANTS = {
  error: {
    icon: AlertCircle,
    container:
      'border-destructive/40 bg-destructive/10 text-destructive',
    iconWrap: 'bg-destructive/15 text-destructive',
    rail: 'bg-destructive',
    role: 'alert',
  },
  success: {
    icon: CheckCircle2,
    container: 'border-success/40 bg-success/10 text-success',
    iconWrap: 'bg-success/15 text-success',
    rail: 'bg-success',
    role: 'status',
  },
}

export default function AuthFormBanner({ variant = 'error', message }) {
  if (!message) return null

  const config = VARIANTS[variant] ?? VARIANTS.error
  const Icon = config.icon

  return (
    <div
      role={config.role}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 pl-5 text-sm shadow-sm animate-auth-banner-in ${config.container}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${config.rail}`}
      />
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${config.iconWrap}`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.4} />
      </span>
      <p className="flex-1 font-medium leading-snug">{message}</p>
    </div>
  )
}
