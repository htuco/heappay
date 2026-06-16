import { createElement } from 'react'
import { ArrowRight, Plus, Send, Wallet } from 'lucide-react'

const ACTIONS = [
  { label: 'Send',     icon: Send,   key: 'send'  },
  { label: 'Add New',  icon: Plus,   key: 'add'   },
  { label: 'Top Up',   icon: Wallet, key: 'topup' },
]

function renderIcon(Icon) {
  return createElement(Icon, { className: 'h-4 w-4', strokeWidth: 2.2 })
}

export default function QuickActions({ onSend, onTopUp, onAddNew }) {
  function handleClick(key) {
    if (key === 'send') onSend?.()
    if (key === 'topup') onTopUp?.()
    if (key === 'add') onAddNew?.()
  }

  return (
    <section className="flex h-full w-full flex-col rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 text-base font-semibold text-card-foreground sm:text-lg">
        Quick Actions
      </h2>
      <div className="flex flex-col gap-2.5">
        {ACTIONS.map(({ label, icon: Icon, key }) => (
          <button
            key={label}
            type="button"
            onClick={() => handleClick(key)}
            className="group flex w-full min-h-11 md:min-h-0 items-center justify-between gap-3 rounded-input border border-border/70 bg-background px-3 py-2 text-sm font-semibold text-foreground transition-all duration-200 touch-manipulation hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-input bg-primary/10 text-primary group-hover:bg-primary/15">
                {renderIcon(Icon)}
              </span>
              {label}
            </span>
            <ArrowRight
              className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          </button>
        ))}
      </div>
    </section>
  )
}
