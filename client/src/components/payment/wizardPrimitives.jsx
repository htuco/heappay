import { Fragment } from 'react'
import { Check } from 'lucide-react'

import CardBrandIcon from '@/components/ui/CardBrandIcon'
import { formatBrandLabel } from '@/utils/paymentCard.utils'
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency'

/**
 * Step scaffolding shared by the payment wizards (send + recurring) so the two
 * flows stay visually identical. These all used to live inside
 * `PaymentWizard.jsx`; they were lifted out unchanged when the recurring create
 * flow became a wizard too — `StepProgress` is the only one that grew a prop
 * (`labels`), since the two wizards have a different number of steps.
 */

export function StepProgress({ labels, current }) {
  // Steps are shrink-0 so their label can't wrap, which means every label shown
  // adds to an intrinsic minimum width. Past three steps that minimum exceeds
  // the modal and the whole body picks up a horizontal scrollbar — so from four
  // steps on, only the current step is labelled and the row runs full width.
  const compact = labels.length > 3

  return (
    <ol
      className={`mx-auto flex w-full items-center ${compact ? '' : 'max-w-sm'}`}
      aria-label="Progress"
    >
      {labels.map((label, i) => {
        const done = i < current
        const active = i === current
        const labelVisibility = active
          ? 'text-card-foreground'
          : compact
          ? 'sr-only'
          : done
          ? 'hidden text-card-foreground/80 sm:inline'
          : 'hidden text-muted-foreground sm:inline'

        return (
          <Fragment key={label}>
            <li className="flex min-w-0 shrink-0 items-center gap-2">
              <div
                aria-current={active ? 'step' : undefined}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-200 ${
                  done
                    ? 'bg-primary text-primary-foreground'
                    : active
                    ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                    : 'bg-muted text-foreground/60 ring-1 ring-border'
                }`}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3.5} /> : i + 1}
              </div>
              {/* sr-only rather than removed, so the step name stays announced. */}
              <span
                className={`truncate text-xs font-semibold transition-colors duration-200 ${labelVisibility}`}
              >
                {label}
              </span>
            </li>
            {i < labels.length - 1 && (
              <div
                aria-hidden="true"
                className={`h-0.5 min-w-3 flex-1 rounded-full transition-colors duration-300 ${
                  compact ? 'mx-1.5' : 'mx-3'
                } ${i < current ? 'bg-primary/60' : 'bg-border'}`}
              />
            )}
          </Fragment>
        )
      })}
    </ol>
  )
}

export function FieldLabel({ htmlFor, children, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold uppercase tracking-wider text-foreground/80"
      >
        {children}
      </label>
      {hint && (
        <span className="text-[11px] font-medium text-muted-foreground">{hint}</span>
      )}
    </div>
  )
}

export function CardOption({ card, selected, onSelect, maskCard, resolveBrand, badge }) {
  const { formatMoney } = useDisplayCurrency()
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative box-border block w-full rounded-surface border-2 p-3.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        selected
          ? 'border-primary/60 bg-primary/8 shadow-sm'
          : 'border-border bg-card hover:border-border/90 hover:bg-muted/40'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-chip border border-border/70 bg-background">
          <CardBrandIcon brand={resolveBrand(card.card_type_id)} width={52} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-mono text-sm font-semibold text-card-foreground">
              {maskCard(card)}
            </p>
            {badge && (
              <span className="shrink-0 rounded-chip bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                {badge}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            <span className="capitalize font-medium text-muted-foreground">
              {formatBrandLabel(resolveBrand(card.card_type_id))}
            </span>
            <span aria-hidden="true" className="text-muted-foreground/50">
              •
            </span>
            <span className="tabular-nums font-semibold text-card-foreground">
              {formatMoney(card.balance)}
            </span>
          </div>
        </div>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
            selected ? 'bg-primary' : 'border border-border bg-background'
          }`}
          aria-hidden="true"
        >
          {selected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3.5} />}
        </span>
      </div>
    </button>
  )
}

export function SegmentedControl({ options, value, onChange, ariaLabel }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex w-full rounded-input bg-muted p-1 ring-1 ring-border/60"
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`min-h-11 flex-1 rounded-chip px-3 py-2 text-sm font-semibold transition-all duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:min-h-0 ${
              active
                ? 'bg-card text-card-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-card-foreground'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function ReceiptRow({ label, value, capitalize, mono }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3 last:border-b-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`text-right text-sm font-semibold text-card-foreground ${
          capitalize ? 'capitalize' : ''
        } ${mono ? 'font-mono' : ''}`}
      >
        {value ?? '—'}
      </dd>
    </div>
  )
}

export function WizardFooter({ children }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-6 mt-8 flex items-center justify-between gap-3 border-t border-border bg-background px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:-mx-7 sm:px-7 md:static md:z-auto md:mx-0 md:bg-transparent md:px-0 md:py-0 md:pb-0 md:pt-5">
      {children}
    </div>
  )
}
