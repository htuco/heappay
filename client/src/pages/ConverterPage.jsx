import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  ArrowRight,
  Info,
  LineChart,
  Loader2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  convertCurrency,
  getPairInsight,
  getRateOverview,
} from '@/services/fxService'

// Frankfurter (ECB) covers exactly these 30 currencies. Kept in sync with the
// source so the dropdown never offers a code the backend can't price.
const CURRENCIES = [
  ['AUD', 'Australian Dollar'],
  ['BRL', 'Brazilian Real'],
  ['CAD', 'Canadian Dollar'],
  ['CHF', 'Swiss Franc'],
  ['CNY', 'Chinese Yuan'],
  ['CZK', 'Czech Koruna'],
  ['DKK', 'Danish Krone'],
  ['EUR', 'Euro'],
  ['GBP', 'British Pound'],
  ['HKD', 'Hong Kong Dollar'],
  ['HUF', 'Hungarian Forint'],
  ['IDR', 'Indonesian Rupiah'],
  ['ILS', 'Israeli Shekel'],
  ['INR', 'Indian Rupee'],
  ['ISK', 'Icelandic Króna'],
  ['JPY', 'Japanese Yen'],
  ['KRW', 'South Korean Won'],
  ['MXN', 'Mexican Peso'],
  ['MYR', 'Malaysian Ringgit'],
  ['NOK', 'Norwegian Krone'],
  ['NZD', 'New Zealand Dollar'],
  ['PHP', 'Philippine Peso'],
  ['PLN', 'Polish Złoty'],
  ['RON', 'Romanian Leu'],
  ['SEK', 'Swedish Krona'],
  ['SGD', 'Singapore Dollar'],
  ['THB', 'Thai Baht'],
  ['TRY', 'Turkish Lira'],
  ['USD', 'US Dollar'],
  ['ZAR', 'South African Rand'],
]

const CURRENCY_OPTIONS = CURRENCIES.map(([value, name]) => ({
  value,
  label: `${value} — ${name}`,
}))

const RECENT_KEY = 'fx-recent-conversions'
const RECENT_LIMIT = 6

function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function isPositive(pct) {
  return typeof pct === 'string' && !pct.trim().startsWith('-')
}

function RateCard({ pair, rate, change, trend, note }) {
  const badge =
    trend === 'up'
      ? 'bg-success/10 text-success'
      : trend === 'down'
        ? 'bg-destructive/10 text-destructive'
        : 'bg-muted text-muted-foreground'
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-foreground">{pair}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge}`}
        >
          {TrendIcon && <TrendIcon className="size-3" aria-hidden />}
          {change}
        </span>
      </div>
      <p className="text-2xl font-bold tracking-tight text-foreground">{rate}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </Card>
  )
}

// "2026-07-03" -> "3 Jul" — a compact, readable day label for the x-axis.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function formatDay(iso) {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? m}`
}

function formatValue(v) {
  const a = Math.abs(v)
  if (a >= 10) return v.toFixed(2)
  if (a >= 1) return v.toFixed(4)
  if (a >= 0.1) return v.toFixed(4)
  return v.toFixed(5)
}

function InsightChart({ points }) {
  if (!points || points.length < 2) return null

  const W = 600
  const H = 220
  const PAD = { top: 18, right: 52, bottom: 34, left: 16 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const nums = points.map((p) => Number(p.rate))
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  // Pad the value range so the line never hugs the top/bottom edge.
  const lo = min - span * 0.18
  const hi = max + span * 0.18
  const vSpan = hi - lo || 1

  const n = points.length
  const xAt = (i) => PAD.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const yAt = (v) => PAD.top + (1 - (v - lo) / vSpan) * plotH
  const baseY = PAD.top + plotH

  const coords = points.map((p, i) => [xAt(i), yAt(Number(p.rate))])
  const linePath = coords
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ')
  const areaPath = `${linePath} L${coords[n - 1][0].toFixed(1)} ${baseY} L${coords[0][0].toFixed(1)} ${baseY} Z`

  // Three horizontal gridlines (top / middle / bottom) with value labels.
  const gridLines = [0, 0.5, 1].map((t) => ({
    y: PAD.top + t * plotH,
    value: hi - t * vSpan,
  }))

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-48 w-full"
      role="img"
      aria-label="Exchange rate trend over the last week"
    >
      <defs>
        <linearGradient id="fx-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridLines.map((g) => (
        <g key={g.y}>
          <line
            x1={PAD.left}
            y1={g.y}
            x2={W - PAD.right}
            y2={g.y}
            stroke="var(--border)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <text
            x={W - PAD.right + 8}
            y={g.y + 4}
            textAnchor="start"
            fill="var(--muted-foreground)"
            fontSize="12"
          >
            {formatValue(g.value)}
          </text>
        </g>
      ))}

      <path d={areaPath} fill="url(#fx-area)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {coords.map(([x, y], i) => (
        <g key={points[i].date}>
          <circle
            cx={x}
            cy={y}
            r="3.5"
            fill="var(--card)"
            stroke="var(--primary)"
            strokeWidth="2"
          />
          <text
            x={x}
            y={H - 10}
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize="12"
          >
            {formatDay(points[i].date)}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function ConverterPage() {
  const [amount, setAmount] = useState('100')
  const [from, setFrom] = useState('EUR')
  const [to, setTo] = useState('USD')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const [rateCards, setRateCards] = useState([])
  const [insight, setInsight] = useState(null)
  const [recent, setRecent] = useState(loadRecent)
  const lastRecordedRef = useRef(null)

  const numericAmount = Number(amount)
  const canConvert =
    amount.trim() !== '' && Number.isFinite(numericAmount) && numericAmount > 0

  // Persisted history of the user's own settled conversions.
  const recordRecent = useCallback((data) => {
    const entry = {
      from: `${data.amount} ${data.from_currency}`,
      to: `${data.converted} ${data.to_currency}`,
    }
    const key = `${entry.from}->${entry.to}`
    if (lastRecordedRef.current === key) return
    lastRecordedRef.current = key
    setRecent((prev) => {
      const next = [entry, ...prev.filter((r) => `${r.from}->${r.to}` !== key)].slice(
        0,
        RECENT_LIMIT,
      )
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        /* storage unavailable — keep in-memory only */
      }
      return next
    })
  }, [])

  // Live reference rate cards (loaded once).
  useEffect(() => {
    let cancelled = false
    getRateOverview()
      .then((data) => {
        if (!cancelled) setRateCards(data.cards ?? [])
      })
      .catch(() => {
        if (!cancelled) setRateCards([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Debounced conversion: refetch shortly after the amount or either currency
  // settles, so typing doesn't fire a request per keystroke.
  useEffect(() => {
    if (!canConvert) {
      setResult(null)
      setError('')
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    const handle = setTimeout(async () => {
      try {
        const data = await convertCurrency({ amount, from, to })
        if (cancelled) return
        setResult(data)
        setError('')
        recordRecent(data)
      } catch (err) {
        if (cancelled) return
        setResult(null)
        setError(err.message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [amount, from, to, canConvert, recordRecent])

  // Live insight for the selected pair.
  useEffect(() => {
    let cancelled = false
    setInsight(null)
    if (from === to) return
    getPairInsight({ from, to })
      .then((data) => {
        if (!cancelled) setInsight(data)
      })
      .catch(() => {
        if (!cancelled) setInsight(null)
      })
    return () => {
      cancelled = true
    }
  }, [from, to])

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  return (
    <div className="w-full space-y-6">
      <header className="space-y-1 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Currency Converter
        </h1>
        <p className="text-sm text-muted-foreground">
          Indicative exchange rates for quick estimates. No money is moved.
        </p>
      </header>

      <Card className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="fx-amount">Amount</Label>
          <Input
            id="fx-amount"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter an amount"
          />
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="fx-from">From</Label>
            <Select
              id="fx-from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              options={CURRENCY_OPTIONS}
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={swap}
            aria-label="Swap currencies"
            className="mb-0.5 shrink-0"
          >
            <ArrowLeftRight />
          </Button>

          <div className="flex-1 space-y-2">
            <Label htmlFor="fx-to">To</Label>
            <Select
              id="fx-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              options={CURRENCY_OPTIONS}
            />
          </div>
        </div>

        <div
          className="min-h-24 rounded-panel border border-border bg-muted/40 px-5 py-4"
          aria-live="polite"
        >
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Converting…
            </div>
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : result ? (
            <div className="space-y-1">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {result.converted}{' '}
                <span className="text-xl font-semibold text-primary">
                  {result.to_currency}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {result.amount} {result.from_currency} · 1 {result.from_currency} ={' '}
                {result.rate} {result.to_currency}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter an amount to see the estimate.
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p>
            {result?.disclaimer ??
              'Indicative rate — for information only. No money is converted here.'}
          </p>
        </div>
      </Card>

      {/* Live reference rate cards */}
      {rateCards.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {rateCards.map((card) => (
            <RateCard key={card.code} {...card} />
          ))}
        </div>
      )}

      {/* Recent conversions + exchange insight */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-bold tracking-tight text-foreground">
                Recent conversions
              </h2>
              <p className="text-sm text-muted-foreground">
                Your latest indicative estimates
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
              This session
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {recent.length > 0 ? (
              recent.map((row) => (
                <div
                  key={`${row.from}-${row.to}`}
                  className="flex items-center justify-between gap-3 rounded-panel border border-border bg-muted/30 px-4 py-3"
                >
                  <span className="text-sm font-bold text-foreground">{row.from}</span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="text-sm font-bold text-foreground">{row.to}</span>
                </div>
              ))
            ) : (
              <p className="rounded-panel border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Your conversions will appear here.
              </p>
            )}
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-bold tracking-tight text-foreground">
                Exchange insight
              </h2>
              <p className="text-sm text-muted-foreground">
                {insight?.summary ?? 'Recent movement for the selected pair.'}
              </p>
            </div>
            <LineChart className="size-5 shrink-0 text-primary" aria-hidden />
          </div>

          {insight?.available ? (
            <>
              <div className="rounded-panel border border-border bg-muted/30 p-4">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-foreground">
                    1 {insight.from_currency} = {insight.latest} {insight.to_currency}
                  </span>
                  {insight.points?.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      as of {formatDay(insight.points[insight.points.length - 1].date)}
                    </span>
                  )}
                </div>
                <InsightChart points={insight.points} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-panel border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">24h movement</p>
                  <p
                    className={`text-lg font-bold ${
                      isPositive(insight.change_pct) ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {insight.change_pct}
                  </p>
                </div>
                <div className="rounded-panel border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">7-day range</p>
                  <p className="text-lg font-bold text-foreground">{insight.range_pct}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="rounded-panel border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Recent history isn’t available for this pair.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
