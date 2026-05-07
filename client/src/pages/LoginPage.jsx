import LoginForm from '@/components/ui/login-form'
import { CreditCard, Send, Shield, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import AuthCloseButton from '@/components/auth-ui/AuthCloseButton'
import { useTheme } from '@/hooks/useTheme'

function DeactivatedNotice() {
	const isDeactivated = new URLSearchParams(window.location.search).get('deactivated') === '1'
	const [visible, setVisible] = useState(isDeactivated)
	if (!visible) return null
	return (
		<div className="mx-6 mt-6 flex items-start justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
			<p>Your account has been deactivated. If this was a mistake, contact support.</p>
			<button
				type="button"
				onClick={() => setVisible(false)}
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

			{/* Theme toggle */}
			<button
				onClick={toggle}
				className="absolute top-4 right-4 z-50 p-2 rounded-lg bg-primary/20 hover:bg-primary/30 transition-colors"
				aria-label="Toggle theme"
			>
				{isDark ? (
					<Sun className="h-5 w-5 text-foreground" />
				) : (
					<Moon className="h-5 w-5 text-foreground" />
				)}
			</button>

			<div>
				<DeactivatedNotice />
				<LoginForm />
			</div>
			<div className="relative overflow-hidden bg-gradient-to-br from-background to-background">
				<div
					className="absolute inset-0"
					style={{
						backgroundImage: isDark
							? 'linear-gradient(130deg, color-mix(in oklab, var(--primary) 78%, #000 22%), color-mix(in oklab, var(--primary) 92%, #000 8%), color-mix(in oklab, var(--primary) 70%, #000 30%))'
							: 'linear-gradient(130deg, color-mix(in oklab, var(--primary) 88%, #fff 12%), color-mix(in oklab, var(--primary) 100%, #fff 0%), color-mix(in oklab, var(--primary) 82%, #fff 18%))',
					}}
				/>
				<div className="auth-orb auth-orb-a" style={{ top: '-5%', left: '-5%', width: '560px', height: '560px', background: 'rgba(125, 211, 252, 0.95)' }} />
				<div className="auth-orb auth-orb-b" style={{ bottom: '-8%', right: '-8%', width: '640px', height: '640px', background: 'rgba(129, 140, 248, 0.85)' }} />
				<div className="auth-orb auth-orb-c" style={{ top: '35%', right: '20%', width: '440px', height: '440px', background: 'rgba(255, 255, 255, 0.7)' }} />

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
						<p className="mx-auto mt-2 md:mt-4 text-sm md:text-[15px] leading-relaxed text-white/85 dark:text-white/85">
						Manage all your cards and track every transaction in one place, with clear insights that help you understand and control your spending.
						</p>
					</div>
				</div>
			</div>
		</section>
	)
}
