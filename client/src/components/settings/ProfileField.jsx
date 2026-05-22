export default function ProfileField({ label, hint, value }) {
  return (
    <div className="block space-y-2">
      <div>
        <span className="text-sm font-semibold text-card-foreground">{label}</span>
        {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="min-h-12 w-full rounded-input border border-border bg-background px-4 py-3 text-sm font-medium text-foreground">
        {value || 'Not available'}
      </div>
    </div>
  )
}
