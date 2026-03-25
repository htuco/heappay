import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

const quickStats = [
  { label: 'Access', value: 'Admin', helper: 'Workspace-level permissions enabled' },
  { label: 'Security', value: 'Strong', helper: 'Password rotated recently' },
  { label: 'Theme', value: 'System', helper: 'Following device preference' },
]

function HeroCard({ onBack }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-border bg-card shadow-xs">
      <div className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(167,76,255,0.12),rgba(167,76,255,0.02)_55%,transparent)] p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" className="w-full sm:w-auto" onClick={onBack}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Settings
            </div>
          </div>

          <div className="max-w-4xl">
            <h1 className="text-2xl font-bold tracking-tight text-card-foreground sm:text-4xl">
              Account settings that feel like a control center
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Password, notifications, security, theme preferences, and account privacy all live
              here in one focused space without an extra sidebar.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-0 sm:grid-cols-3">
        {quickStats.map((stat, index) => (
          <div
            key={stat.label}
            className={`p-4 sm:p-5 ${index < quickStats.length - 1 ? 'border-b border-border/70 sm:border-r sm:border-b-0' : ''}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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

export default function SettingsPage() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto w-full max-w-6xl">
      <HeroCard onBack={() => navigate(-1)} />
    </div>
  )
}
