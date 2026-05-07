import RegisterForm from '@/components/ui/register-form'
import { CreditCard, Send, Shield, Moon, Sun } from 'lucide-react'
import AuthCloseButton from '@/components/auth-ui/AuthCloseButton'
import AuthOrbs from '@/components/auth-ui/AuthOrbs'
import { useTheme } from '@/hooks/useTheme'

export default function RegisterPage() {
	const { isDark, toggle } = useTheme()

	return (
		<section className="grid min-h-screen grid-cols-1 md:grid-cols-[35%_65%]">
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
						Your money shouldn’t be a mystery
					</h2>
					<p className="mx-auto mt-2 md:mt-4 text-sm md:text-base leading-relaxed text-white/85 dark:text-white/85">
							Create your account and get a clear view of every payment you make.
						</p>
					</div>
				</div>
			</div>

			<div>
				<RegisterForm />
			</div>
		</section>
	)
}
