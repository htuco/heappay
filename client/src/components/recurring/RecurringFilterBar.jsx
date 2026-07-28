import { Search, TriangleAlert, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const FREQUENCY_OPTIONS = [
  { value: 'all', label: 'Any frequency' },
  { value: 'every-month', label: 'Every month' },
  { value: 'specific-months', label: 'Specific months' },
]

export default function RecurringFilterBar({
  filters,
  onChange,
  onClear,
  statusOptions,
  matchCount,
  totalCount,
  hasAttentionRules,
}) {
  const isFiltering = Boolean(filters.q || filters.status || filters.freq || filters.attention)
  const showStatus = statusOptions.length > 1

  return (
    <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
      <div className="relative md:w-56">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          type="search"
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Search name or note…"
          className="h-8 rounded-input border-border/70 bg-background pl-8 text-sm shadow-none placeholder:text-muted-foreground/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 md:contents">
        {showStatus && (
          <Select
            value={filters.status || 'all'}
            onChange={(e) => onChange({ status: e.target.value === 'all' ? '' : e.target.value })}
            options={[{ value: 'all', label: 'All statuses' }, ...statusOptions]}
            aria-label="Filter by status"
            className="h-8 rounded-input border-border/70 bg-background py-0 shadow-none md:w-auto"
          />
        )}

        <Select
          value={filters.freq || 'all'}
          onChange={(e) => onChange({ freq: e.target.value === 'all' ? '' : e.target.value })}
          options={FREQUENCY_OPTIONS}
          aria-label="Filter by frequency"
          className="h-8 rounded-input border-border/70 bg-background py-0 shadow-none md:w-auto"
        />
      </div>

      {hasAttentionRules && (
        <Button
          variant={filters.attention ? 'default' : 'outline'}
          size="sm"
          aria-pressed={filters.attention}
          onClick={() => onChange({ attention: !filters.attention })}
          className={cn(
            'h-8 gap-1.5 rounded-input px-2.5 text-xs shadow-none',
            !filters.attention && 'border-border/70',
          )}
        >
          <TriangleAlert className="size-3.5" />
          Needs attention
        </Button>
      )}

      <div className="flex items-center gap-2">
        {isFiltering && (
          <Button
            variant="ghost"
            className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            onClick={onClear}
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}

        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {isFiltering
            ? `${matchCount} of ${totalCount} recurring payments`
            : `${totalCount} recurring payment${totalCount === 1 ? '' : 's'}`}
        </span>
      </div>
    </div>
  )
}
