import { Check, ChevronDown } from 'lucide-react'

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { currencyMeta } from '@/lib/currencyMeta'
import { cn } from '@/lib/utils'

export default function CurrencySelect({ value, onChange, options, id, ariaLabel, className }) {
  const selected = currencyMeta(value)

  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel ?? `Currency: ${selected.code}`}
          className={cn(
            'inline-flex items-center gap-2 rounded-input border-2 border-border bg-input px-3 py-2 text-sm font-semibold text-foreground outline-none transition-all',
            'hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'data-[state=open]:border-ring data-[state=open]:ring-3 data-[state=open]:ring-ring/50',
            className,
          )}
        >
          <span className="text-base leading-none" aria-hidden>
            {selected.flag}
          </span>
          <span className="tracking-tight">{selected.code}</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="max-h-72 w-64">
        {options.map((code) => {
          const meta = currencyMeta(code)
          const isSelected = code === value
          return (
            <DropdownMenuItem
              key={code}
              onSelect={() => onChange(code)}
              className="justify-between gap-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-base leading-none" aria-hidden>
                  {meta.flag}
                </span>
                <span className="font-semibold text-foreground">{meta.code}</span>
                <span className="truncate text-muted-foreground">{meta.name}</span>
              </span>
              {isSelected && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  )
}
