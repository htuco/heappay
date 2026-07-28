import { createContext, useContext } from "react"

/**
 * Carries the top bar's page-action slot node so a page can render its primary
 * action into the app shell while the state that action opens stays local to
 * the page. `usePageActionSlot()` returns null before the slot has mounted and
 * outside Layout.
 */
export const PageActionSlotContext = createContext(null)

export function usePageActionSlot() {
  return useContext(PageActionSlotContext)
}
