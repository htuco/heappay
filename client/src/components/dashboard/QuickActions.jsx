import { createElement } from 'react'
import { ArrowRight, CreditCard, Plus, Send, Download, Wallet } from 'lucide-react'

const ACTIONS = [
  { label: 'Send',     icon: Send,       key: 'send'    },
  { label: 'Request',  icon: Download,   key: 'request', disabled: true },
  { label: 'Add New',  icon: Plus,       key: 'add'     },
  { label: 'Pay Bill', icon: CreditCard, key: 'bill',    disabled: true },
  { label: 'Top Up',   icon: Wallet,     key: 'topup'   },
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
    <section className="flex h-full w-full flex-col rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6 xl:max-w-[464px] xl:justify-self-end">
      <h2 className="mb-4 text-base font-semibold text-card-foreground sm:text-lg">
        Quick Actions
      </h2>
      <div className="flex flex-col gap-2.5">
        {ACTIONS.map(({ label, icon: Icon, key, disabled }) => (
          disabled ? (
            <div
              key={label}
              title="Coming soon"
              className="flex w-full items-center justify-between gap-3 rounded-input border border-border/70 bg-background px-3 py-2 text-sm font-semibold text-foreground opacity-50 cursor-not-allowed select-none"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-input bg-primary/10 text-primary">
                  {renderIcon(Icon)}
                </span>
                {label}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                Coming soon
              </span>
            </div>
          ) : (
            <button
              key={label}
              type="button"
              onClick={() => handleClick(key)}
              className="group flex w-full items-center justify-between gap-3 rounded-input border border-border/70 bg-background px-3 py-2 text-sm font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5"
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
          )
        ))}
      </div>
    </section>
  )
}
