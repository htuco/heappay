import logo from '@/assets/logo.png'

export default function LandingPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-8 text-center px-4">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        </div>

        <div className="relative z-10 space-y-6">
          {/* Logo + Heap */}
          <div className="flex items-center justify-center gap-4">
            <img
              src={logo}
              alt="Heap logo"
              className="h-10 w-auto sm:h-12 md:h-14"
            />
            <span className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Heap
            </span>
          </div>

          {/* Headline + text */}
          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              Manage your money smarter.
            </h1>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
              A clean way to see your cards, wallet, and payments in one place —
              designed to feel as good as it looks.
            </p>
          </div>

          {/* Buttons (all next to each other) */}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <a
              href="/login"
              className="rounded-full bg-primary px-10 py-3.5 text-sm font-semibold text-primary-foreground shadow-md hover:shadow-lg hover:opacity-95 transition"
            >
              Log in
            </a>
            <a
              href="/register"
              className="rounded-full border border-border bg-card px-10 py-3.5 text-sm font-semibold text-card-foreground hover:bg-muted transition"
            >
              Create account
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}