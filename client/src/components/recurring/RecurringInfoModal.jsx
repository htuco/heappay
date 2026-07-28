import { CalendarClock, CreditCard, Pencil, TriangleAlert } from 'lucide-react'

import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

const POINTS = [
  {
    icon: CalendarClock,
    title: 'Monthly, on a day you pick',
    body: 'Pick a day of the month and the payment repeats on that day. Restrict it to certain months if you like — leave months unselected to run every month. Shorter months fall back to their last day.',
    accent: 'bg-primary/10 text-primary',
  },
  {
    icon: CreditCard,
    title: 'From your card to theirs',
    body: 'Every run sends the amount from the card you chose to your recipient. Keep that card active and funded — a frozen card or a short balance makes the run fail.',
    accent: 'bg-success/10 text-success',
  },
  {
    icon: TriangleAlert,
    title: 'Failed runs are flagged',
    body: 'If a payment can’t go through, the plan shows up under “Action Required” so you can fix it. Runs that already succeeded aren’t affected.',
    accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    icon: Pencil,
    title: 'Change or stop it anytime',
    body: 'Edit the amount, day, months or note whenever you need. Cancelling stops every future payment — it never reverses ones already sent.',
    accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  },
]

/**
 * Explains how recurring payments behave, opened from the empty state.
 *
 * `text-left` is explicit because `Modal` renders inline rather than through a
 * portal, so it would otherwise inherit the empty state's `text-center`.
 */
export default function RecurringInfoModal({ isOpen, onClose }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="How recurring payments work"
      subtitle="Set a payment up once and it goes out on schedule."
      size="lg"
      className="text-left"
    >
      <div className="space-y-5">
        <ul className="space-y-2.5">
          {POINTS.map(({ icon, title, body, accent }) => {
            const Icon = icon
            return (
              <li
                key={title}
                className="flex gap-3.5 rounded-surface border border-border/60 bg-muted/20 p-3.5"
              >
                <span
                  className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-input ${accent}`}
                  aria-hidden
                >
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold leading-snug text-card-foreground">
                    {title}
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            )
          })}
        </ul>

        <div className="flex justify-end border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  )
}
