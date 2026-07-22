import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpDown,
  Info,
  LineChart,
  Loader2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import CurrencySelect from '@/components/converter/CurrencySelect'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useWallet } from '@/hooks/useWallet'
import { currencyMeta } from '@/lib/currencyMeta'
import { cn } from '@/lib/utils'
import {
  convertCurrency,
  getPairInsight,
  getRateOverview,
} from '@/services/fxService'

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

const CURRENCY_CODES = CURRENCIES.map(([code]) => code)

const RANGES = [
  { value: '7d', label: '7D', noun: '7-day' },
  { value: '30d', label: '30D', noun: '30-day' },
  { value: '90d', label: '90D', noun: '90-day' },
  { value: '1y', label: '1Y', noun: '1-year' },
]

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

function formatRelative(ms) {
  if (!ms) return ''
  const secs = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  return `${hrs}h ago`
}

function formatBalance(code, value) {
  if (value == null) return null
  const { symbol } = currencyMeta(code)
  const n = Number(value)
  const formatted = Number.isFinite(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value
  return `${symbol}${formatted}`
}

function RateCard({ code, pair, rate, change, trend, note }) {
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
        <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <span className="text-sm leading-none" aria-hidden>
            {currencyMeta(code).flag}
          </span>
          {pair}
        </span>
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

function InsightTooltip({ active, payload, fromCurrency, toCurrency }) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  return (
    <div className="rounded-input border border-border bg-card px-3 py-2 shadow-lg">
      <p className="mb-0.5 text-xs text-muted-foreground">{formatDay(point.date)}</p>
      <p className="tabular-nums text-sm font-semibold text-card-foreground">
        1 {fromCurrency} = {formatValue(point.rate)} {toCurrency}
      </p>
    </div>
  )
}

function InsightChart({ points, fromCurrency, toCurrency }) {
  if (!points || points.length < 2) return null

  const data = points.map((p) => ({ date: p.date, rate: Number(p.rate) }))
  const values = data.map((d) => d.rate)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min || 1) * 0.18

  return (
    <ResponsiveContainer width="100%" height={192}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="fx-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDay}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
          interval="preserveStartEnd"
        />
        <YAxis
          orientation="right"
          width={54}
          domain={[min - pad, max + pad]}
          tickFormatter={formatValue}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          content={<InsightTooltip fromCurrency={fromCurrency} toCurrency={toCurrency} />}
          wrapperStyle={{ zIndex: 20, pointerEvents: 'none' }}
        />
        <Area
          type="monotone"
          dataKey="rate"
          stroke="var(--primary)"
          strokeWidth={2.5}
          fill="url(#fx-area)"
          dot={false}
          activeDot={{ r: 4, fill: 'var(--card)', stroke: 'var(--primary)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
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
  const [range, setRange] = useState('7d')
  const [recent, setRecent] = useState(loadRecent)
  const lastRecordedRef = useRef(null)

  const { walletBalance } = useWallet()
  const [balances, setBalances] = useState({ from: null, to: null })
  const [updatedAt, setUpdatedAt] = useState(null)
  const [, forceTick] = useState(0)

  const numericAmount = Number(amount)
  const canConvert =
    amount.trim() !== '' && Number.isFinite(numericAmount) && numericAmount > 0

  const recordRecent = useCallback((data) => {
    const entry = {
      fromAmount: data.amount,
      fromCode: data.from_currency,
      toAmount: data.converted,
      toCode: data.to_currency,
      at: Date.now(),
    }
    const key = `${entry.fromAmount} ${entry.fromCode}->${entry.toAmount} ${entry.toCode}`
    if (lastRecordedRef.current === key) return
    lastRecordedRef.current = key
    setRecent((prev) => {
      const keyOf = (r) =>
        r.fromCode
          ? `${r.fromAmount} ${r.fromCode}->${r.toAmount} ${r.toCode}`
          : `${r.from}->${r.to}`
      const next = [entry, ...prev.filter((r) => keyOf(r) !== key)].slice(0, RECENT_LIMIT)
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        return next
      }
      return next
    })
  }, [])

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
        setUpdatedAt(Date.now())
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

  useEffect(() => {
    let cancelled = false
    setInsight(null)
    if (from === to) return
    getPairInsight({ from, to, range })
      .then((data) => {
        if (!cancelled) setInsight(data)
      })
      .catch(() => {
        if (!cancelled) setInsight(null)
      })
    return () => {
      cancelled = true
    }
  }, [from, to, range])

  useEffect(() => {
    let cancelled = false
    const wb = Number(walletBalance)
    if (!Number.isFinite(wb) || wb <= 0) {
      setBalances({ from: '0.00', to: '0.00' })
      return
    }
    const inCurrency = async (code) => {
      if (code === 'USD') return wb.toFixed(2)
      try {
        const data = await convertCurrency({ amount: wb, from: 'USD', to: code })
        return data.converted
      } catch {
        return null
      }
    }
    Promise.all([inCurrency(from), inCurrency(to)]).then(([f, t]) => {
      if (!cancelled) setBalances({ from: f, to: t })
    })
    return () => {
      cancelled = true
    }
  }, [from, to, walletBalance])

  useEffect(() => {
    if (!updatedAt) return
    const id = setInterval(() => forceTick((n) => n + 1), 30000)
    return () => clearInterval(id)
  }, [updatedAt])

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const isLiveRate = result?.source?.startsWith('live')
  const receiveDisplay = result && !isLoading && !error ? result.converted : null

  return (
    <div className="w-full space-y-6">
      <Card className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
          <div className="flex flex-col gap-3 rounded-panel border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="fx-amount"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                You send
              </label>
              <CurrencySelect
                id="fx-from"
                value={from}
                onChange={setFrom}
                options={CURRENCY_CODES}
                ariaLabel="Currency you send"
              />
            </div>
            <input
              id="fx-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-transparent text-3xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <p className="text-xs text-muted-foreground">
              Balance: {formatBalance(from, balances.from) ?? '—'}
            </p>
          </div>

          <div className="flex items-center justify-center md:px-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={swap}
              aria-label="Swap currencies"
              className="rounded-full shadow-sm"
            >
              <ArrowUpDown />
            </Button>
          </div>

          <div className="flex flex-col gap-3 rounded-panel border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                You receive
              </span>
              <CurrencySelect
                id="fx-to"
                value={to}
                onChange={setTo}
                options={CURRENCY_CODES}
                ariaLabel="Currency you receive"
              />
            </div>
            <div className="flex min-h-[2.25rem] items-center" aria-live="polite">
              {isLoading ? (
                <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
              ) : error ? (
                <span role="alert" className="text-sm text-destructive">
                  {error}
                </span>
              ) : (
                <span className="text-3xl font-bold tracking-tight text-foreground">
                  {receiveDisplay ?? '0.00'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Balance: {formatBalance(to, balances.to) ?? '—'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-panel border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {result ? (
              <span className="font-semibold text-foreground">
                1 {result.from_currency} = {result.rate} {result.to_currency}
              </span>
            ) : (
              <span className="text-muted-foreground">Enter an amount to see the rate.</span>
            )}
            {result && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  isLiveRate ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    isLiveRate ? 'bg-success' : 'bg-muted-foreground'
                  }`}
                  aria-hidden
                />
                {isLiveRate ? 'Live rate' : 'Reference rate'}
              </span>
            )}
          </div>
          {updatedAt && (
            <span className="text-xs text-muted-foreground">
              Rate updated {formatRelative(updatedAt)}
            </span>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p>
            {result?.disclaimer ??
              'Indicative rate for information only. No money was converted.'}
          </p>
        </div>
      </Card>

      {rateCards.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {rateCards.map((card) => (
            <RateCard key={card.code} {...card} />
          ))}
        </div>
      )}

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
              recent.map((row, i) => {
                const fromLabel = row.fromCode
                  ? `${row.fromAmount} ${row.fromCode}`
                  : row.from
                const toLabel = row.toCode ? `${row.toAmount} ${row.toCode}` : row.to
                return (
                  <div
                    key={row.at ?? `${fromLabel}-${toLabel}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-panel border border-border bg-muted/30 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-bold text-foreground">
                        {fromLabel}
                      </span>
                      <ArrowRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="truncate text-sm font-bold text-foreground">
                        {toLabel}
                      </span>
                    </div>
                    {row.at && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelative(row.at)}
                      </span>
                    )}
                  </div>
                )
              })
            ) : (
              <p className="rounded-panel border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Your conversions will appear here.
              </p>
            )}
          </div>
          {recent.length > 0 && (
            <div className="mt-auto flex items-center justify-between gap-2 pt-1">
              <span className="text-xs text-muted-foreground">Kept on this device only.</span>
              <button
                type="button"
                disabled
                title="Full conversion history is coming soon."
                className="cursor-not-allowed text-xs font-semibold text-muted-foreground/60"
              >
                View all conversions →
              </button>
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <LineChart className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div className="space-y-1">
                <h2 className="text-base font-bold tracking-tight text-foreground">
                  Exchange rate insight
                </h2>
                <p className="text-sm text-muted-foreground">
                  {insight?.summary ?? 'Recent movement for the selected pair.'}
                </p>
              </div>
            </div>
            <div className="inline-flex rounded-input border border-border bg-muted/40 p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRange(r.value)}
                  aria-pressed={range === r.value}
                  className={cn(
                    'rounded-[6px] px-2.5 py-1 text-xs font-semibold transition-colors',
                    range === r.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {from === to ? (
            <p className="rounded-panel border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Pick two different currencies to see the trend.
            </p>
          ) : insight === null ? (
            <div className="h-48 w-full animate-pulse rounded-panel bg-muted/50" />
          ) : insight.available ? (
            <>
              <div className="rounded-panel border border-border bg-muted/30 p-4">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-foreground">
                    1 {insight.from_currency} = {insight.latest} {insight.to_currency}
                  </span>
                  {insight.points?.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      as of {formatDay(insight.points[insight.points.length - 1].date)}
                    </span>
                  )}
                </div>
                <InsightChart
                  points={insight.points}
                  fromCurrency={insight.from_currency}
                  toCurrency={insight.to_currency}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-panel border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Movement</p>
                  <p
                    className={`text-lg font-bold ${
                      isPositive(insight.change_pct) ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {insight.change_pct}
                  </p>
                </div>
                <div className="rounded-panel border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {RANGES.find((r) => r.value === range)?.noun ?? '7-day'} range
                  </p>
                  <p className="text-lg font-bold text-foreground">{insight.range_pct}</p>
                </div>
              </div>

              <div className="mt-auto flex justify-end pt-1">
                <button
                  type="button"
                  disabled
                  title="A full-screen chart is coming soon."
                  className="cursor-not-allowed text-xs font-semibold text-muted-foreground/60"
                >
                  View full chart →
                </button>
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
