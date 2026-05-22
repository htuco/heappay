const formatValue = (value) => value.charAt(0).toUpperCase() + value.slice(1)

export default function SettingsHero({ accessLevel, themePreference, isDark }) {
  const normalizedAccess = accessLevel ? formatValue(accessLevel.replace(/_/g, ' ')) : 'Loading'
  const normalizedTheme = themePreference ? formatValue(themePreference) : 'System'
  const quickStats = [
    {
      label: 'Access',
      value: normalizedAccess,
      helper: accessLevel
        ? `${normalizedAccess} permission level active`
        : 'Permission level loading',
    },
    {
      label: 'Theme',
      value: normalizedTheme,
      helper:
        themePreference === 'system'
          ? `Following device preference, currently ${isDark ? 'Dark' : 'Light'}`
          : `${normalizedTheme} preference active`,
    },
  ]

  return (
    <section className="overflow-hidden rounded-panel border border-border bg-card shadow-xs">
      <div className="grid gap-0 sm:grid-cols-2">
        {quickStats.map((stat, index) => (
          <div
            key={stat.label}
            className={`p-4 sm:p-5 ${index < quickStats.length - 1 ? 'border-b border-border/70 sm:border-r sm:border-b-0' : ''}`}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-card-foreground">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.helper}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
