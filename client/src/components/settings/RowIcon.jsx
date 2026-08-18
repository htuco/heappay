/**
 * RowIcon, the one icon square used across settings: a 36px `rounded-input`
 * tile holding a 16px glyph.
 *
 * Rows use the default `accent` tint uniformly — a row's on/off state is
 * carried by its StatusPill, not by the icon, so every row reads at the same
 * weight. `neutral` is for a collapsed subsection header, where the icon is
 * chrome rather than the subject of the row.
 */
const TONES = {
  accent: 'border-primary/20 bg-primary/10 text-primary',
  neutral: 'border-border bg-muted/40 text-muted-foreground',
}

export default function RowIcon({ icon, tone = 'accent' }) {
  const IconComponent = icon

  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-input border ${
        TONES[tone] ?? TONES.accent
      }`}
    >
      <IconComponent className="h-4 w-4" aria-hidden="true" />
    </span>
  )
}
