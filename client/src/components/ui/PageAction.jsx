import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { usePageActionSlot } from "@/components/ui/page-action-context"
import { cn } from "@/lib/utils"

/**
 * Renders a page's primary action into the global top bar, left of the theme
 * toggle. A portal rather than a route → action registry: the button stays part
 * of the page's own React tree, so it reaches page state directly and the slot
 * empties itself when the route unmounts — there is no registration to clear
 * and no way to leave the previous page's action behind.
 *
 * Renders nothing until the slot node exists (first Layout paint) or on a page
 * rendered outside Layout.
 */
export function PageActionSlot({ children }) {
  const slot = usePageActionSlot()
  if (!slot) return null
  return createPortal(children, slot)
}

/**
 * One fixed size for every page action, so the button is the same height,
 * padding, weight and icon size on all pages — only the label's width differs.
 * `min-h-0` overrides the Button size variant's `min-h-11 md:min-h-0`, which
 * would otherwise make the button taller between `sm` and `md` than it is on
 * either side.
 *
 * Below `sm` it becomes a 44px square: the top bar already carries a title, a
 * subtitle and three controls, and a labelled button overflows a 375px
 * viewport.
 */
const PAGE_ACTION_CLASS =
  "h-11 w-11 min-h-0 gap-2 px-0 text-sm font-semibold shadow-sm sm:h-10 sm:w-auto sm:px-4"

/**
 * The single shape every page action takes. The accessible name comes from
 * `aria-label`, so it survives the label collapsing to an icon below `sm`.
 *
 * `icon` is required, not optional: below `sm` the icon is the only thing left,
 * so an action without one renders as a blank square.
 */
export function PageActionButton({ icon, label, className, ...props }) {
  // Assigned rather than destructured as `{ icon: Icon }`: ESLint has no react
  // plugin here, so a JSX-only capitalised prop still trips `no-unused-vars`.
  const Icon = icon

  return (
    <Button aria-label={label} className={cn(PAGE_ACTION_CLASS, className)} {...props}>
      <Icon className="size-4.5 sm:size-4" strokeWidth={2.2} aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  )
}
