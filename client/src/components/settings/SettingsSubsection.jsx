import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

import RowIcon from '@/components/settings/RowIcon'

/**
 * SettingsSubsection, a collapsible, labeled group of rows inside a
 * SettingsSection.
 *
 * Breaks a long, undifferentiated stack of control rows into separate
 * disclosure panels so each concern (recovery vs. verification vs. payment
 * confirmation) can be expanded on demand instead of scrolling one wall.
 *
 * Controlled when `open` + `onToggle` are passed (lets a parent enforce
 * accordion behavior, one open at a time); otherwise self-manages via
 * `defaultOpen`. The header is a real button (`aria-expanded` /
 * `aria-controls`); the body animates open with the grid-rows `0fr to 1fr`
 * technique and collapses instantly under `prefers-reduced-motion`.
 */
export default function SettingsSubsection({
  title,
  description,
  icon,
  open: controlledOpen,
  onToggle,
  defaultOpen = false,
  children,
}) {
  const isControlled = controlledOpen !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const regionId = useId()

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.(!open)
    } else {
      setUncontrolledOpen((current) => !current)
    }
  }

  return (
    <section className="overflow-hidden rounded-surface border border-border bg-background/40">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={handleToggle}
        className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
          open ? 'bg-muted/30' : ''
        }`}
      >
        {icon ? <RowIcon icon={icon} tone="neutral" /> : null}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-card-foreground">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      <div
        id={regionId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-border px-4 py-4">{children}</div>
        </div>
      </div>
    </section>
  )
}
