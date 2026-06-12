import LoginForm from '@/components/ui/login-form'
import { CreditCard, Send, Shield, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AuthCloseButton from '@/components/auth-ui/AuthCloseButton'
import AuthOrbs from '@/components/auth-ui/AuthOrbs'
import { useTheme } from '@/hooks/useTheme'

const LOGIN_BANNERS = {
  deactivated: {
    className:
      'border-destructive/40 bg-destructive/10 text-destructive',
    message:
      'Your account has been deactivated. If this was a mistake, contact support.',
  },
  suspended: {
    className:
      'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200',
    message:
      'Your account has been suspended. Sign in again only after an administrator restores your access.',
  },
  invited: {
    className: 'border-primary/40 bg-primary/10 text-foreground',
    message:
      'Please complete your invitation and set a password before using Heap.',
  },
  passwordChanged: {
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
    message: 'Your password was updated. Sign in with your new password.',
  },
}

function LoginStatusBanner() {
  const [searchParams] = useSearchParams()
  const [dismissed, setDismissed] = useState({})

  const activeKey = ['deactivated', 'suspended', 'invited', 'passwordChanged'].find(
    (key) => searchParams.get(key) === '1',
  )

  if (!activeKey || dismissed[activeKey]) {
    return null
  }

  const banner = LOGIN_BANNERS[activeKey]

  return (
    <div
      className={`mx-6 mt-6 flex items-start justify-between gap-3 rounded-input border px-4 py-3 text-sm ${banner.className}`}
    >
      <p>{banner.message}</p>
      <button
        type="button"
        onClick={() => setDismissed((prev) => ({ ...prev, [activeKey]: true }))}
        className="shrink-0 font-semibold hover:underline"
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  )
}

export default function LoginPage() {
  const { isDark, toggle } = useTheme()

  return (
    <section className="grid min-h-screen grid-cols-1 md:grid-cols-[65%_35%]">
      <AuthCloseButton />

      <button
        onClick={toggle}
        className="absolute top-4 right-4 z-50 p-2 rounded-input bg-primary/20 hover:bg-primary/30 transition-colors"
        aria-label="Toggle theme"
      >
        {isDark ? (
          <Sun className="h-5 w-5 text-foreground" />
        ) : (
          <Moon className="h-5 w-5 text-foreground" />
        )}
      </button>

      <div>
        <LoginStatusBanner />
        <LoginForm />
      </div>
      <div className="relative overflow-hidden bg-linear-to-br from-background to-background">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: isDark
              ? 'linear-gradient(130deg, color-mix(in oklab, var(--primary) 78%, #000 22%), color-mix(in oklab, var(--primary) 92%, #000 8%), color-mix(in oklab, var(--primary) 70%, #000 30%))'
              : 'linear-gradient(130deg, color-mix(in oklab, var(--primary) 88%, #fff 12%), color-mix(in oklab, var(--primary) 100%, #fff 0%), color-mix(in oklab, var(--primary) 82%, #fff 18%))',
          }}
        />
        <AuthOrbs />

        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 text-center text-white dark:text-white md:px-6 xl:px-8">
          <div className="max-w-85">
            <div className="mb-6 md:mb-8 flex justify-center gap-4 md:gap-6">
              <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full backdrop-blur-md border bg-white/25 border-white/40">
                <CreditCard className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full backdrop-blur-md border bg-white/25 border-white/40">
                <Send className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div className="flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full backdrop-blur-md border bg-white/25 border-white/40">
                <Shield className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
            </div>
            <h2 className="text-2xl md:text-4xl leading-tight font-semibold tracking-tight text-white dark:text-white">
              "Your cards, finally connected."
            </h2>
            <p className="mx-auto mt-2 md:mt-4 text-sm md:text-base leading-relaxed text-white/85 dark:text-white/85">
              Manage all your cards and track every transaction in one place, with clear insights that help you understand and control your spending.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
