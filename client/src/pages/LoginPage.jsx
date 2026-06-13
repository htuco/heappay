import LoginForm from '@/components/ui/login-form'
import { ArrowLeftRight, CreditCard, Moon, ShieldCheck, Sun } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AuthCloseButton from '@/components/auth-ui/AuthCloseButton'
import AuthMobileBackground from '@/components/auth-ui/AuthMobileBackground'
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
		<section className="relative grid min-h-svh grid-cols-1 overflow-hidden md:grid-cols-[65%_35%]">
			<AuthMobileBackground />
			<AuthCloseButton />

			{/* Theme toggle */}
			<button
				onClick={toggle}
				className="absolute top-[max(1rem,env(safe-area-inset-top,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] z-50 flex h-11 w-11 items-center justify-center rounded-input bg-primary/20 hover:bg-primary/30 transition-colors touch-manipulation"
				aria-label="Toggle theme"
			>
				{isDark ? (
					<Sun className="h-5 w-5 text-foreground" />
				) : (
					<Moon className="h-5 w-5 text-foreground" />
				)}
			</button>

			<div className="auth-form-panel relative z-10">
				<LoginStatusBanner />
				<LoginForm />
			</div>
			<div className="relative hidden overflow-hidden bg-background md:block">
				<AuthMobileBackground className="auth-mobile-background--desktop" />

				<div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-4 text-center text-slate-950 dark:text-white md:px-6 xl:px-8">
					<div className="max-w-85">
						<div className="mb-6 flex justify-center gap-4 md:mb-7 md:gap-5">
							<div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-950/10 bg-white/35 text-slate-900/70 backdrop-blur-sm dark:border-white/25 dark:bg-white/12 dark:text-white/80 md:h-12 md:w-12">
								<CreditCard className="h-5 w-5 md:h-6 md:w-6" />
							</div>
							<div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-950/10 bg-white/35 text-slate-900/70 backdrop-blur-sm dark:border-white/25 dark:bg-white/12 dark:text-white/80 md:h-12 md:w-12">
								<ArrowLeftRight className="h-5 w-5 md:h-6 md:w-6" />
							</div>
							<div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-950/10 bg-white/35 text-slate-900/70 backdrop-blur-sm dark:border-white/25 dark:bg-white/12 dark:text-white/80 md:h-12 md:w-12">
								<ShieldCheck className="h-5 w-5 md:h-6 md:w-6" />
							</div>
						</div>
						<h2 className="text-2xl md:text-4xl leading-tight font-semibold tracking-tight">
							Your cards, finally connected.
						</h2>
						<p className="mx-auto mt-2 md:mt-4 text-sm md:text-base leading-relaxed text-slate-800/75 dark:text-white/85">
							Manage cards, track transactions, and stay in control of your spending.
						</p>
					</div>
				</div>
			</div>
		</section>
	)
}
