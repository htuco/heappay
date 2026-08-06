/**
 * SettingsNav, the settings section switcher.
 *
 * Desktop: a flat rail of plain text labels, grouped under small uppercase
 * headings, sitting on the page background beside the elevated detail pane —
 * the surface difference is what divides the two. The active item is a tinted
 * pill with accent text. Mobile: a horizontal scroll of the same items with the
 * group headings dropped, so the pattern collapses without a separate menu
 * view.
 *
 * Controlled: the parent owns `active` and handles `onSelect`.
 */
export default function SettingsNav({ groups, active, onSelect }) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:gap-5 xl:overflow-visible xl:pb-0"
    >
      {groups.map((group) => (
        <div key={group.label} className="flex shrink-0 gap-2 xl:flex-col xl:gap-0.5">
          <p className="hidden text-[11px] font-semibold uppercase tracking-wider text-muted-foreground xl:mb-1 xl:block xl:px-3">
            {group.label}
          </p>
          {group.items.map(({ id, label }) => {
            const isActive = id === active
            return (
              <button
                key={id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect(id)}
                className={`shrink-0 rounded-input px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 xl:w-full ${
                  isActive
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'font-normal text-muted-foreground hover:bg-muted/50 hover:text-card-foreground'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
