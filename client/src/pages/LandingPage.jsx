import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import Cards from 'react-credit-cards-2'
import 'react-credit-cards-2/dist/es/styles-compiled.css'
import logo from '@/assets/logo.png'
import { Button } from '@/components/ui/button'
import {
  CreditCard,
  Wallet,
  ArrowLeftRight,
  ShieldCheck,
  TrendingUp,
  Zap,
  Globe,
  Bell,
  ChevronRight,
  Star,
  Lock,
} from 'lucide-react'

// ── Count-up hook (triggers on scroll into view) ──────────────────────────────
function useCountUp(target, duration = 1800) {
  const [value, setValue] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef(null)
  const raf = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStarted(true); obs.disconnect() } },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!started) return
    const startTime = performance.now()
    function tick(now) {
      const p = Math.min((now - startTime) / duration, 1)
      setValue(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [started, target, duration])

  return [value, ref]
}

// ── Floating card scene ───────────────────────────────────────────────────────
const DEMO_CARDS = [
  { number: '•••• •••• •••• 1111', name: 'Sara Mitchell', expiry: '12/28', cvc: '•••',  issuer: 'visa' },
  { number: '•••• •••• •••• 5559', name: 'Luka Tomas',    expiry: '09/27', cvc: '•••',  issuer: 'mastercard' },
  { number: '•••• •••••• •8431',   name: 'Amira Kovac',   expiry: '03/29', cvc: '••••', issuer: 'american-express' },
]

function FloatingCard({ card, style, flip = false }) {
  return (
    <div className="landing-float-card" style={style}>
      <Cards
        number={card.number}
        name={card.name}
        expiry={card.expiry}
        cvc={flip ? card.cvc : ''}
        issuer={card.issuer}
        preview
        focused={flip ? 'cvc' : ''}
      />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ prefix = '', target, suffix = '', label, decimals = 0, duration = 1800 }) {
  const [value, ref] = useCountUp(target, duration)
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return (
    <div ref={ref} className="flex flex-col items-center gap-1.5 text-center">
      <span className="text-4xl font-extrabold tracking-tight sm:text-5xl">
        {prefix}{formatted}{suffix}
      </span>
      <span className="text-sm font-medium text-white/70">{label}</span>
    </div>
  )
}

const FEATURES = [
  { icon: CreditCard,     title: 'Smart Card Management',   desc: 'Add, freeze, and manage multiple cards. Real-time brand detection and animated live previews.' },
  { icon: Wallet,         title: 'Unified Wallet',          desc: 'Your total balance across all cards — always visible, always accurate.' },
  { icon: ArrowLeftRight, title: 'Instant Transfers',       desc: 'Send money between cards or to others in seconds. Every transfer tracked.' },
  { icon: TrendingUp,     title: 'Spending Insights',       desc: 'Visualise your money flow month by month. Spot trends early.' },
  { icon: Bell,           title: 'Real-time Alerts',        desc: 'Instant notifications for top-ups, transfers, and card status changes.' },
  { icon: Globe,          title: 'Multi-currency Ready',    desc: 'Built for international use. Your money travels as far as you do.' },
]

const STEPS = [
  { n: '01', title: 'Create your account',  desc: 'Sign up in under a minute — no paperwork, no waiting.' },
  { n: '02', title: 'Add your cards',       desc: 'Link Visa, Mastercard, Amex or any major card instantly.' },
  { n: '03', title: 'Take control',         desc: 'Send, receive, and track money from one clean dashboard.' },
]

const TESTIMONIALS = [
  { name: 'Sara M.',   role: 'Freelance designer',    quote: 'Finally a fintech app that actually looks good. The card preview alone sold me.' },
  { name: 'Luka T.',   role: 'Software engineer',     quote: "I've tried a dozen wallet apps. Heap is the first one I've actually kept." },
  { name: 'Amira K.',  role: 'Small business owner',  quote: "Managing client payments used to be chaos. Now it's one clean screen." },
]

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground antialiased">

      {/* ─ Floating card keyframes injected once ─ */}
      <style>{`
        @keyframes floatA {
          0%, 100% { transform: rotate(10deg) scale(0.9) translateY(0px); }
          50%       { transform: rotate(10deg) scale(0.9) translateY(-16px); }
        }
        @keyframes floatB {
          0%, 100% { transform: rotate(-8deg) scale(0.88) translateY(0px); }
          50%       { transform: rotate(-8deg) scale(0.88) translateY(-20px); }
        }
        @keyframes floatC {
          0%, 100% { transform: translate(-50%, -50%) rotate(-3deg) scale(1.12) translateY(0px); }
          50%       { transform: translate(-50%, -50%) rotate(-3deg) scale(1.12) translateY(-14px); }
        }
        .landing-float-card { position: absolute; filter: drop-shadow(0 28px 50px rgba(15,23,42,0.32)); }
        .landing-float-card .rccs { margin: 0 !important; }
        .landing-float-card .rccs__card { border-radius: 16px !important; overflow: hidden !important; }
        .landing-float-card .rccs__card--front,
        .landing-float-card .rccs__card--back { border-radius: 16px !important; }
      `}</style>

      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Heap" className="h-7 w-auto" />
            <span className="text-lg font-bold tracking-tight">Heap</span>
          </div>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground sm:flex">
            <a href="#features"      className="transition hover:text-foreground">Features</a>
            <a href="#how"           className="transition hover:text-foreground">How it works</a>
            <a href="#testimonials"  className="transition hover:text-foreground">Reviews</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full px-5 font-semibold">
              <Link to="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        {/* background gradient mesh */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/12 blur-[140px]" />
          <div className="absolute top-20 right-[-100px] h-80 w-80 rounded-full bg-primary-light/20 blur-[100px]" />
          <div className="absolute bottom-0 left-[-80px] h-64 w-64 rounded-full bg-primary-dark/15 blur-[90px]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-5 py-10 sm:py-16 lg:grid-cols-2 lg:py-24">

          {/* ─ Left: copy ─ */}
          <div className="order-2 lg:order-1 space-y-8 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-3.5 py-1.5 text-xs font-semibold text-primary">
              <Zap className="h-3.5 w-3.5" />
              Live card previews · 11 card networks
            </div>

            <h1 className="text-5xl font-extrabold leading-[1.07] tracking-tight sm:text-6xl md:text-7xl">
              Your wallet,<br />
              <span className="bg-gradient-to-r from-primary-light via-primary to-primary-dark bg-clip-text text-transparent">
                reimagined.
              </span>
            </h1>

            <p className="mx-auto max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
              Cards, balances, and payments in one beautifully designed dashboard.
              Built for people who care about how their tools look and feel.
            </p>

            <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
              <Button asChild size="lg" className="h-12 rounded-full px-8 font-bold shadow-lg hover:shadow-xl">
                <Link to="/register">
                  Create free account <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-full px-8 font-semibold">
                <Link to="/login">Log in</Link>
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-5 text-xs text-muted-foreground lg:justify-start">
              {['No credit card required', 'Free to get started', 'Bank-grade security'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* ─ Right: floating cards ─ */}
          <div className="order-1 lg:order-2 relative flex h-[280px] items-center justify-center sm:h-[360px] lg:h-[580px]">
            {/* scale wrapper — shrinks cards on mobile */}
            <div className="relative h-full w-full scale-[0.62] sm:scale-[0.78] lg:scale-100" style={{ transformOrigin: 'center center' }}>
              {/* Amex — back, top-right */}
              <FloatingCard
                card={DEMO_CARDS[2]}
                flip
                style={{
                  top: '0%',
                  right: '0%',
                  animation: 'floatA 5.5s ease-in-out infinite',
                  zIndex: 1,
                  opacity: 0.88,
                }}
              />
              {/* Mastercard — bottom-left */}
              <FloatingCard
                card={DEMO_CARDS[1]}
                style={{
                  bottom: '0%',
                  left: '0%',
                  animation: 'floatB 6.2s ease-in-out infinite 1s',
                  zIndex: 1,
                  opacity: 0.88,
                }}
              />
              {/* Visa — centre, largest */}
              <FloatingCard
                card={DEMO_CARDS[0]}
                style={{
                  top: '50%',
                  left: '50%',
                  animation: 'floatC 5s ease-in-out infinite 0.4s',
                  zIndex: 2,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-light via-primary to-primary-dark text-white">
        <div className="pointer-events-none absolute -top-20 right-0 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-5xl grid-cols-2 gap-10 px-5 py-16 sm:grid-cols-4">
          <StatCard target={50000} suffix="+"  label="Active users"      duration={1600} />
          <StatCard target={2.4}   suffix="B+" label="Volume processed"  decimals={1} prefix="$" duration={2000} />
          <StatCard target={99.9}  suffix="%"  label="Uptime"            decimals={1} duration={1400} />
          <StatCard target={11}    suffix="+"  label="Card networks"     duration={1200} />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="mx-auto w-full max-w-6xl px-5 py-24">
        <div className="mb-14 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">Features</p>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            Everything your money needs
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            From card management to spending insights — all in a UI you'll actually enjoy using.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="group flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-lg"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="mb-1.5 font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto max-w-5xl px-5 py-24">
          <div className="mb-14 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">How it works</p>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Up and running in minutes</h2>
          </div>

          <div className="relative grid gap-8 sm:grid-cols-3">
            {/* connector line */}
            <div className="pointer-events-none absolute top-7 left-[calc(16.67%+28px)] right-[calc(16.67%+28px)] hidden h-px bg-border sm:block" />

            {STEPS.map(({ n, title, desc }) => (
              <div key={n} className="flex flex-col items-center gap-4 text-center">
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-extrabold text-primary-foreground shadow-lg">
                  {n}
                </span>
                <h3 className="font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECURITY STRIP ── */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16">
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-primary/20 bg-primary/5 px-8 py-12 text-center sm:flex-row sm:text-left">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="h-7 w-7" />
          </span>
          <div>
            <h3 className="text-lg font-bold">Bank-grade security, always</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              CVV numbers are never stored. All card data is encrypted at rest and in transit.
              Your money and your information stay yours.
            </p>
          </div>
          <Button asChild className="ml-auto shrink-0 rounded-full px-6 font-semibold">
            <Link to="/register">Get started free</Link>
          </Button>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-5 py-24">
          <div className="mb-14 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">Reviews</p>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Loved by real people</h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {TESTIMONIALS.map(({ name, role, quote }) => (
              <div key={name} className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-6">
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">"{quote}"</p>
                <div>
                  <p className="text-sm font-bold">{name}</p>
                  <p className="text-xs text-muted-foreground">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-light via-primary to-primary-dark">
        <div className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center text-white">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            Ready to take control?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/80">
            Join thousands managing their money smarter with Heap. Free to start, no card needed.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-full bg-white px-8 font-bold text-primary shadow-xl hover:bg-white/90">
              <Link to="/register">Create free account</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-12 rounded-full px-8 font-semibold text-white hover:bg-white/15">
              <Link to="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border/60 bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Heap" className="h-5 w-auto opacity-60" />
            <span className="font-semibold">Heap</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <a href="#features"     className="transition hover:text-foreground">Features</a>
            <a href="#how"          className="transition hover:text-foreground">How it works</a>
            <a href="#testimonials" className="transition hover:text-foreground">Reviews</a>
            <Link to="/login"       className="transition hover:text-foreground">Log in</Link>
            <Link to="/register"    className="transition hover:text-foreground">Sign up</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
