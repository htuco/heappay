import { MONTH_OPTIONS, ordinal } from '@/utils/recurringPayments.utils'

/**
 * Form controls shared by the recurring-payment create wizard and the edit
 * dialog. Lifted out of `RecurringPaymentList.jsx` unchanged when create became
 * a wizard, so both surfaces stay in sync on amount entry and month selection.
 * Constants and formatters live in `utils/recurringPayments.utils.js`.
 */

const MIN_DAY = 1
const MAX_DAY = 31
// The three days that cover most real schedules — payday, mid-month, month end.
// 31 is labelled "Last day" because the runner falls back to the last available
// day in shorter months, so it genuinely means "end of month".
const QUICK_DAYS = [
  { day: 1, label: '1st' },
  { day: 15, label: '15th' },
  { day: MAX_DAY, label: 'Last day' },
]

function clampDay(n) {
  if (Number.isNaN(n)) return null
  return Math.min(MAX_DAY, Math.max(MIN_DAY, n))
}

/**
 * Day-of-month picker: a compact stepper plus quick picks.
 *
 * Deliberately neither a 31-option `<select>` (the native dropdown overflows the
 * viewport and makes you scroll a flat list of numbers) nor a 31-cell grid (too
 * much tapping surface on a phone). A stepper keeps the control one row tall at
 * every width, still allows typing an exact day, and the three quick picks cover
 * the schedules people actually set.
 *
 * `value` / `onChange` are strings so this drops into the existing form state.
 */
export function DayOfMonthPicker({ value, onChange }) {
  const selected = value ? Number(value) : null

  function step(delta) {
    onChange(String(clampDay((selected ?? 0) + delta)))
  }

  function handleInput(e) {
    const raw = e.target.value.replace(/\D/g, '')
    if (raw === '') {
      onChange('')
      return
    }
    onChange(String(clampDay(Number(raw))))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor="recurring-day-of-month"
          className="text-xs font-semibold uppercase tracking-wider text-foreground/80"
        >
          Day of month
        </label>
        <span className="text-[11px] font-medium text-muted-foreground">
          {selected ? `${selected}${ordinal(selected)}` : 'Pick a day'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-36 flex-1 items-center rounded-input border border-border bg-card">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={selected !== null && selected <= MIN_DAY}
            aria-label="Previous day"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-l-input text-lg font-semibold text-muted-foreground transition-colors touch-manipulation hover:bg-muted/60 hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            −
          </button>
          <input
            id="recurring-day-of-month"
            type="text"
            inputMode="numeric"
            value={value ?? ''}
            onChange={handleInput}
            placeholder="—"
            aria-label="Day of month"
            className="min-w-0 flex-1 bg-transparent py-2 text-center text-base font-semibold tabular-nums text-card-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
          />
          <button
            type="button"
            onClick={() => step(1)}
            disabled={selected !== null && selected >= MAX_DAY}
            aria-label="Next day"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-r-input text-lg font-semibold text-muted-foreground transition-colors touch-manipulation hover:bg-muted/60 hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            +
          </button>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5">
          {QUICK_DAYS.map(({ day, label }) => {
            const active = selected === day
            return (
              <button
                key={day}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(String(day))}
                className={`min-h-11 whitespace-nowrap rounded-chip px-2.5 text-xs font-semibold transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:min-h-0 sm:py-2 ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {selected > 28 && (
        <p className="text-xs text-muted-foreground">
          Months without a {selected}
          {ordinal(selected)} run on their last day instead.
        </p>
      )}
    </div>
  )
}

export function AmountInput({ value, onChange }) {
  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 7)
    const cents = digits ? parseInt(digits, 10) : 0
    const padded = String(cents).padStart(3, '0')
    onChange(cents === 0 ? '' : `${padded.slice(0, -2)}.${padded.slice(-2)}`)
  }

  function toDisplay(val) {
    if (!val) return ''
    const cents = Math.round(parseFloat(val) * 100)
    if (cents === 0) return ''
    const padded = String(cents).padStart(3, '0')
    return `${padded.slice(0, -2)}.${padded.slice(-2)}`
  }

  const display = toDisplay(value)
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder="0.00"
      value={display}
      onChange={handleChange}
      size={Math.max(4, (display || '0.00').length)}
      className="min-w-[3ch] bg-transparent text-center text-3xl font-bold leading-none tabular-nums tracking-tight text-card-foreground outline-none placeholder:text-muted-foreground/40"
    />
  )
}

export function MonthPicker({ value, onChange }) {
  const allSelected = value.length === 0

  function toggleMonth(m) {
    if (value.includes(m)) {
      onChange(value.filter((x) => x !== m))
    } else {
      onChange([...value, m].sort((a, b) => a - b))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
          Months
        </label>
        <button
          type="button"
          onClick={() => onChange([])}
          className={`text-xs font-semibold transition-colors ${
            allSelected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All months
        </button>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {MONTH_OPTIONS.map((m) => {
          const active = value.includes(m.value)
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => toggleMonth(m.value)}
              className={`rounded-chip py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>
      {!allSelected && (
        <p className="text-xs text-muted-foreground">
          {value.length === 1 ? '1 month selected' : `${value.length} months selected`}
        </p>
      )}
    </div>
  )
}
