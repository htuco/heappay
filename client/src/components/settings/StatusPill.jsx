/**
 * StatusPill, the one status pill shape used across every settings section.
 *
 * Tones: `success` (Verified / Active / Default), `neutral` (Not enabled /
 * None set), `warning` (pending verification, reversible actions).
 *
 * Settings previously grew four near-identical pills — two spellings of the
 * same amber, plus a differently shaped one on the login-email row. Everything
 * routes through here so the shape and the palette are decided in one place.
 */
const TONES = {
  success: 'border-success/30 bg-success/10 text-success',
  neutral: 'border-border bg-muted/40 text-muted-foreground',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
}

export default function StatusPill({ tone = 'neutral', icon, children }) {
  const IconComponent = icon

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        TONES[tone] ?? TONES.neutral
      }`}
    >
      {IconComponent ? <IconComponent className="h-3 w-3" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}
