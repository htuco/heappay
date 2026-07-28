/**
 * The shell's page-header band: title, one plain-language subtitle, and the
 * page's actions pushed to the right. Rendered once by `Layout` from `PAGE_META`
 * — pages don't render their own heading. Actions arrive through the
 * `PageActionSlot` portal, which enforces one primary action per page.
 *
 * Hairline only, no shadow. Stays sticky so a page's primary action is reachable
 * while its content scrolls.
 */
export default function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card px-4 pb-4 pt-5 sm:px-6 md:px-8 md:pb-5 md:pt-7">
      <div className="flex items-center gap-4">
        {title && (
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground md:text-[26px]">
              {title}
            </h1>
            {subtitle && (
              <p className="hidden truncate text-sm font-normal text-muted-foreground sm:block">
                {subtitle}
              </p>
            )}
          </div>
        )}
        {actions && <div className="ml-auto flex shrink-0 items-center gap-2.5">{actions}</div>}
      </div>
    </header>
  )
}
