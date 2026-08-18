/**
 * SettingsSection, one section of the settings detail pane.
 *
 * The section title and its one-line description live here, in the content
 * column, over a hairline divider — the nav carries only labels. Replaces the
 * older `SettingsCard`, which repeated the pane's own card chrome (border +
 * `bg-card` + shadow) around every section and put an icon square beside each
 * title; the pane is the single surface now, so sections read as sections
 * rather than as a stack of nested cards.
 */
export default function SettingsSection({ title, description, action, children }) {
  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-card-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="w-full sm:w-auto">{action}</div> : null}
      </div>
      <div className="mt-4 border-t border-border pt-5">{children}</div>
    </section>
  )
}
