import { Link } from 'react-router-dom'
import { useState, useEffect, useLayoutEffect, useRef } from 'react'
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
  Globe,
  Bell,
  ChevronRight,
  Star,
  Lock,
  Moon,
  Sun,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

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

// ── Rotating word (CSS-driven slide+fade, no measurement, no layout jump) ───
// Each new word remounts (via `key={index}`) which restarts a single CSS
// keyframe animation. The wrapper is `inline-block` and resizes with the
// content — no absolute positioning, no width measurement, no React transition
// state machine. The animation runs entirely in CSS, which Safari handles
// reliably even with `bg-clip-text` gradient fills.
const WORD_INTERVAL_MS = 2800

function RotatingWord({ words, className = '' }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!words || words.length < 2) return undefined
    const t = setTimeout(() => setIndex((i) => (i + 1) % words.length), WORD_INTERVAL_MS)
    return () => clearTimeout(t)
  }, [index, words])

  if (!words || words.length === 0) return null

  // The animated wrapper has no `bg-clip-text` — that lives on the inner span.
  // Safari can't smoothly animate opacity/transform on a `bg-clip-text` element
  // because the gradient has to be re-rasterised every frame, which it skips.
  // Animating the plain wrapper instead keeps the gradient as a static paint.
  // Padding + negative margin gives the descenders/ascenders room so the text
  // is not clipped while it slides, without altering surrounding line metrics.
  return (
    <span
      style={{
        display: 'inline-block',
        verticalAlign: 'baseline',
        paddingBottom: '0.2em',
        marginBottom: '-0.2em',
        overflow: 'visible',
      }}
    >
      <span
        key={index}
        style={{
          display: 'inline-block',
          animation: 'rotating-word-enter 700ms cubic-bezier(0.22, 1, 0.36, 1) both',
          WebkitAnimation: 'rotating-word-enter 700ms cubic-bezier(0.22, 1, 0.36, 1) both',
          willChange: 'transform, opacity',
          paddingBottom: '0.15em',
          marginBottom: '-0.15em',
        }}
      >
        <span
          className={className}
          style={{
            display: 'inline-block',
            paddingRight: '0.08em',
            paddingBottom: '0.25em',
            marginBottom: '-0.15em',
            lineHeight: 1.15,
          }}
        >
          {words[index]}
        </span>
      </span>
    </span>
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
    <div ref={ref} className="flex flex-col items-center gap-0.5 text-center">
      <span className="text-2xl font-extrabold tracking-tight sm:text-3xl">
        {prefix}{formatted}{suffix}
      </span>
      <span className="text-xs font-medium text-white/70">{label}</span>
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
  const { isDark, toggle } = useTheme()
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
        @keyframes rotating-word-enter {
          0%   { opacity: 0; transform: translateY(0.5em); }
          100% { opacity: 1; transform: translateY(0); }
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
            <button
              type="button"
              onClick={toggle}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex h-11 w-11 md:h-9 md:w-9 items-center justify-center rounded-full text-muted-foreground transition touch-manipulation hover:bg-muted/60 hover:text-foreground"
            >
              {isDark ? <Sun className="h-4 w-4" strokeWidth={2} /> : <Moon className="h-4 w-4" strokeWidth={2} />}
            </button>
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
            <h1 className="text-5xl font-extrabold leading-[1.07] tracking-tight sm:text-6xl md:text-7xl">
              Your wallet,<br />
              <RotatingWord
                words={['reimagined.', 'simplified.', 'unleashed.', 'in your pocket.']}
                className="bg-linear-to-r from-primary-light via-primary to-primary-dark bg-clip-text text-transparent"
              />
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
        <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-0 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-4xl grid-cols-2 gap-6 px-5 py-8 sm:grid-cols-4 sm:gap-4">
          <StatCard target={5000}  suffix="+"  label="Active users"      duration={1600} />
          <StatCard target={1}     suffix="M+" label="Volume processed"  prefix="$" duration={2000} />
          <StatCard target={99.9}  suffix="%"  label="Uptime"            decimals={1} duration={1400} />
          <StatCard target={11}    suffix="+"  label="Card networks"     duration={1200} />
        </div>
      </section>

      {/* ── APP PREVIEW ── */}
      <section className="relative overflow-hidden border-b border-border/60 bg-muted/20">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="relative mx-auto w-full max-w-6xl px-5 py-24">
          <div className="mb-14 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">A peek inside</p>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Designed to be looked at
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
              Most banking apps make you work. Heap makes you smile.
            </p>
          </div>

          {/* Browser-style mockup */}
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-surface border border-border/60 bg-card">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
              <span className="h-3 w-3 rounded-full bg-green-400/80" />
              <span className="ml-4 truncate rounded-chip bg-background/80 px-3 py-1 text-xs text-muted-foreground">heap.app/dashboard</span>
            </div>

            {/* Dashboard body */}
            <div className="grid gap-5 p-6 sm:grid-cols-3">
              {/* Total balance card */}
              <div className="sm:col-span-2 rounded-input bg-gradient-to-br from-primary-light via-primary to-primary-dark p-6 text-white">
                <p className="text-xs font-medium uppercase tracking-widest text-white/70">Total balance</p>
                <p className="mt-2 text-4xl font-extrabold tracking-tight">$12,847.59</p>
                <div className="mt-4 flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-semibold">
                    <TrendingUp className="h-3 w-3" /> +8.2% this month
                  </span>
                  <span className="text-white/70">across 3 cards</span>
                </div>
              </div>

              {/* Quick stat */}
              <div className="rounded-input border border-border/60 bg-background p-5">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">This month</p>
                <p className="mt-2 text-2xl font-bold">$2,341</p>
                <p className="mt-1 text-xs text-muted-foreground">42 transactions</p>
                <div className="mt-3 flex items-end gap-1 h-10">
                  {[40, 65, 35, 78, 52, 88, 70].map((h, i) => (
                    <div key={i} className="flex-1 rounded-chip bg-primary/30" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>

              {/* Recent activity */}
              <div className="sm:col-span-3 rounded-input border border-border/60 bg-background">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                  <p className="text-sm font-semibold">Recent activity</p>
                  <span className="text-xs text-muted-foreground">Last 24h</span>
                </div>
                <div className="divide-y divide-border/40">
                  {[
                    { name: 'Sara Mitchell',  amount: '+$420.00', type: 'incoming', tag: 'Payment' },
                    { name: 'Coffee Roastery', amount: '−$8.50',   type: 'outgoing', tag: 'Card ****1111' },
                    { name: 'Top-up',          amount: '+$500.00', type: 'incoming', tag: 'Card ****5559' },
                  ].map((row) => (
                    <div key={row.name} className="flex items-center justify-between px-5 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${row.type === 'incoming' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {row.type === 'incoming' ? <ArrowLeftRight className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
                        </span>
                        <div>
                          <p className="font-medium leading-tight">{row.name}</p>
                          <p className="text-xs text-muted-foreground">{row.tag}</p>
                        </div>
                      </div>
                      <span className={`font-mono text-sm font-semibold ${row.type === 'incoming' ? 'text-primary' : 'text-foreground'}`}>{row.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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
              className="group flex flex-col gap-4 rounded-surface border border-border/60 bg-card p-6 transition-all duration-200 hover:border-primary/30 hover:shadow-lg"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-input bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
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
                <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-surface bg-primary text-lg font-extrabold text-primary-foreground shadow-lg">
                  {n}
                </span>
                <h3 className="font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ── */}
      <section className="mx-auto w-full max-w-5xl px-5 py-24">
        <div className="mb-14 text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">The difference</p>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Heap vs the old way
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Old way */}
          <div className="rounded-surface border border-border/60 bg-card p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-bold">×</span>
              <h3 className="font-bold text-muted-foreground">Traditional banking</h3>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                'Branch visits and paperwork to open an account',
                'Separate apps for cards, transfers, and statements',
                'Statements arrive monthly — no real-time picture',
                'Customer support behind 20-minute hold queues',
                'Hidden fees buried in fine print',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Heap */}
          <div className="rounded-surface border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-transparent p-7 shadow-lg">
            <div className="mb-5 flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <h3 className="font-bold">Heap</h3>
            </div>
            <ul className="space-y-3 text-sm">
              {[
                'Sign up in under a minute, fully online',
                'One dashboard for every card, transfer, and balance',
                'Live updates every second — see money as it moves',
                'Self-service for everything; humans for the rest',
                'Transparent pricing, no surprises',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── SECURITY STRIP ── */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16">
        <div className="flex flex-col items-center gap-6 rounded-panel border border-primary/20 bg-primary/5 px-8 py-12 text-center sm:flex-row sm:text-left">
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-surface bg-primary/10 text-primary">
            <Lock className="h-7 w-7" />
          </span>
          <div>
            <h3 className="text-lg font-bold">Bank-grade security, always</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              CVV numbers are never stored. All card data is encrypted at rest and in transit.
              Your money and your information stay yours.
            </p>
          </div>
          <Button asChild className="shrink-0 rounded-full px-6 font-semibold sm:ml-auto">
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
              <div key={name} className="flex flex-col gap-4 rounded-surface border border-border/60 bg-card p-6">
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
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
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
