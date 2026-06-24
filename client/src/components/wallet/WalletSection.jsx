import { cn } from '@/lib/utils'

export default function WalletSection({
  title,
  subtitle,
  icon,
  actions,
  headerClassName = '',
  className = '',
  children,
  as: Tag = 'section',
  mobileChromeless = false,
}) {
  const hasHeader = title || subtitle || icon || actions
  // mobileChromeless drops the panel frame below md so full-bleed content
  // (e.g. the card carousel) isn't boxed in on phones.
  const chrome = mobileChromeless
    ? 'md:rounded-panel md:border md:border-border md:bg-card md:p-6 md:shadow-sm'
    : 'rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6'
  return (
    <Tag className={cn(chrome, className)}>
      {hasHeader && (
        <header
          className={`mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${headerClassName}`}
        >
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-linear-to-br from-primary/15 to-primary-light/15 text-primary">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="text-lg font-semibold tracking-tight text-card-foreground sm:text-xl">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              {actions}
            </div>
          )}
        </header>
      )}
      {children}
    </Tag>
  )
}
