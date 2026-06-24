import { cn } from '@/lib/utils'

/**
 * A sized placeholder block for loading states. Pulses by default; stays static
 * under `prefers-reduced-motion`. Reuses the app's `bg-muted` token so it reads
 * as a neutral fill in both themes. Pass width/height via className so each
 * skeleton occupies the exact box its loaded content will — that's how we keep
 * the wallet page from shifting or expanding when data arrives.
 */
export default function Skeleton({ className, ...props }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-input bg-muted motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  )
}
