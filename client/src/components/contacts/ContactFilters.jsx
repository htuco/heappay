import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { CONTACT_VIEW_OPTIONS } from '@/utils/contacts.utils'

/**
 * Search box + All / Pinned / Recent view switch for the contacts list. One
 * segmented control instead of a row of dropdowns — the views are mutually
 * exclusive and there are only three of them.
 */
export default function ContactFilters({ search, onSearchChange, view, onViewChange, disabled }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border/60 p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search name, email or card"
          disabled={disabled}
          aria-label="Search contacts"
          className="border-transparent bg-muted/50 pl-9 placeholder:text-muted-foreground/70"
        />
      </div>

      <div
        role="tablist"
        aria-label="Filter contacts"
        className="inline-flex shrink-0 rounded-input bg-muted/60 p-1"
      >
        {CONTACT_VIEW_OPTIONS.map((option) => {
          const active = view === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={disabled}
              onClick={() => onViewChange(option.value)}
              className={`min-h-9 flex-1 rounded-chip px-4 text-sm font-semibold transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-50 sm:flex-none ${
                active
                  ? 'bg-card text-card-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:text-card-foreground'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
