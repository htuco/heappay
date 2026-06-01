import { createContext, useContext } from "react"

/**
 * Carries the modal's generated ARIA ids so split-variant consumers
 * (SplitModal, PaymentWizard) can tag their own title/description nodes
 * instead of hardcoding a shared static id. `useModalAria()` returns null
 * outside a Modal.
 */
export const ModalAriaContext = createContext(null)

export function useModalAria() {
  return useContext(ModalAriaContext)
}
