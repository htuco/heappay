export default function ProfileField({ label, hint, ...props }) {
  return (
    <label className="block space-y-2">
      <div>
        <span className="text-sm font-semibold text-card-foreground">{label}</span>
        {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      </div>
      <input
        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
        {...props}
      />
    </label>
  )
}
