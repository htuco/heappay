import { Sparkles } from 'lucide-react'

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
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-xs">
      <div className="bg-emphasis-strong border-b border-border/70 p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Settings
          </div>

          <div className="max-w-4xl">
            <h1 className="text-2xl font-bold tracking-tight text-card-foreground sm:text-4xl">
              Account settings that feel like a control center
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Password, notifications, theme preferences, and account privacy all live here in one
              focused space without an extra sidebar.
            </p>
          </div>
        </div>
      </div>

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
