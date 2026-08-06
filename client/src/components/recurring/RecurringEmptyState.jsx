import { useState } from 'react'
import {
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Info,
  Plus,
  RefreshCw,
  ShieldCheck,
  User,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import RecurringInfoModal from '@/components/recurring/RecurringInfoModal'

const STEPS = [
  { icon: User, label: ['Choose', 'recipient'], accent: 'bg-primary/10 text-primary' },
  { icon: CircleDollarSign, label: ['Select', 'amount'], accent: 'bg-success/10 text-success' },
  {
    icon: CalendarDays,
    label: ['Pick', 'schedule'],
    accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  },
  {
    icon: ShieldCheck,
    label: ['Review', 'before activation'],
    accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
]

/** Decorative calendar-with-refresh mark shown when no rules exist yet. */
function EmptyIllustration() {
  return (
    <div className="relative mx-auto flex size-40 items-center justify-center" aria-hidden>
      <div className="absolute inset-0 rounded-full bg-linear-to-br from-primary/8 via-primary/5 to-transparent" />
      <div className="absolute inset-6 rounded-full bg-primary/5" />

      {/* Sparkles */}
      <span className="absolute left-6 top-9 size-1.5 rotate-45 rounded-sm bg-primary/30" />
      <span className="absolute right-8 top-7 size-1 rotate-45 rounded-sm bg-primary/25" />
      <span className="absolute bottom-9 left-10 size-1 rotate-45 rounded-sm bg-primary/25" />
      <span className="absolute right-7 bottom-11 size-1.5 rotate-45 rounded-sm bg-primary/30" />

      <div className="relative">
        <CalendarDays className="size-20 text-primary/70" strokeWidth={1.4} />
        <span className="absolute -bottom-1 -right-2 flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-card">
          <RefreshCw className="size-4.5" strokeWidth={2.6} />
        </span>
      </div>
    </div>
  )
}

/**
 * Empty state for the recurring payments page — carries the value proposition
 * and the four things the create wizard will ask for, so a first-time user knows
 * what they're signing up for before opening it.
 */
export default function RecurringEmptyState({ onCreate }) {
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <>
      <div className="rounded-card border border-border bg-card px-6 py-10 text-center sm:px-10 sm:py-14">
        <EmptyIllustration />

        <h3 className="mt-4 text-xl font-bold tracking-tight text-card-foreground sm:text-2xl">
          No recurring payments yet
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Schedule payments once and we&apos;ll send them automatically.
          <br className="hidden sm:inline" /> Perfect for subscriptions, invoices, rent and more.
        </p>

        <ul className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-y-5 sm:grid-cols-4 sm:gap-y-0">
          {STEPS.map(({ icon, label, accent }, i) => {
            const Icon = icon
            return (
              <li
                key={label.join(' ')}
                className={`flex items-center justify-center gap-2.5 px-3 ${
                  i > 0 ? 'sm:border-l sm:border-border/70' : ''
                }`}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-input ${accent}`}
                  aria-hidden
                >
                  <Icon className="size-4.5" />
                </span>
                <span className="text-left text-xs font-medium leading-snug text-muted-foreground">
                  {label[0]}
                  <br />
                  {label[1]}
                </span>
              </li>
            )
          })}
        </ul>

        <Button className="mt-9" onClick={onCreate}>
          <Plus className="mr-1.5 size-4" />
          Create recurring payment
        </Button>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-input px-2 py-1 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Info className="size-4" />
            Learn more about recurring payments
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <RecurringInfoModal isOpen={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  )
}
