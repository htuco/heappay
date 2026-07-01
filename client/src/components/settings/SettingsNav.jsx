/**
 * SettingsNav, the settings section switcher.
 *
 * Desktop: a vertical sub-nav rail beside the detail pane (active item gets a
 * left accent + tint). Mobile: a horizontal scroll of the same items above the
 * pane, so the pattern collapses gracefully without a separate menu view.
 *
 * Controlled: the parent owns `active` and handles `onSelect`.
 */
export default function SettingsNav({ items, active, onSelect }) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:gap-1.5 xl:overflow-visible xl:pb-0"
    >
      {items.map(({ id, label, description, icon }) => {
        const Icon = icon
        const isActive = id === active
        return (
          <button
            key={id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(id)}
            className={`group relative flex shrink-0 items-center gap-3 rounded-input px-3.5 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 xl:w-full ${
              isActive
                ? 'bg-primary/8 text-card-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary xl:before:content-[""]'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-card-foreground'
            }`}
          >
            <Icon
              className={`h-5 w-5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-card-foreground'}`}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className={`block text-sm font-semibold ${isActive ? 'text-primary' : ''}`}>
                {label}
              </span>
              {description ? (
                <span className="hidden text-xs text-muted-foreground xl:block">{description}</span>
              ) : null}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
