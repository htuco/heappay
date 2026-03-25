import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const modalVariants = cva(
  "bg-background border rounded-lg shadow-lg w-full max-h-[90vh] overflow-auto relative transition-all duration-200",
  {
    variants: {
      size: {
        default: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const Modal = React.forwardRef(
  ({ isOpen, onClose, title, children, className, size = "default", ...props }, ref) => {
    const handleBackdropClick = (e) => {
      if (e.target === e.currentTarget) onClose()
    }

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose()
    }

    React.useEffect(() => {
      if (!isOpen) return
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 transition-opacity duration-200",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <div
          ref={ref}
          className={cn(
            modalVariants({ size }),
            isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95",
            className
          )}
          {...props}
        >
          <div className="flex items-center justify-between p-4 border-b">
            <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded hover:bg-muted transition-colors"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
          <div id="modal-description" className="p-4">
            {children}
          </div>
        </div>
      </div>
    )
  }
)

Modal.displayName = "Modal"

export { Modal }