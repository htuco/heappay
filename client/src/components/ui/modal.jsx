import { forwardRef, useEffect, useId } from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { ModalAriaContext, useModalAria } from "@/components/ui/modal-context"

/**
 * Heading for a split-variant modal. Renders an <h2> already wired to the
 * modal's generated `aria-labelledby` id, so consumers don't hardcode one.
 */
export function ModalTitle({ className, children, ...props }) {
  const aria = useModalAria()
  return (
    <h2 id={aria?.titleId} className={className} {...props}>
      {children}
    </h2>
  )
}

const modalVariants = cva(
  "bg-background border border-border/60 rounded-panel w-full max-h-[90vh] overflow-auto relative animate-in fade-in-0 zoom-in-85 slide-in-from-bottom-14 duration-500 ease-[cubic-bezier(0.34,1.45,0.64,1)]",
  {
    variants: {
      size: {
        default: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        "2xl": "max-w-2xl",
        "3xl": "max-w-3xl",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const Modal = forwardRef(
  (
    {
      isOpen,
      onClose,
      title,
      subtitle,
      children,
      className,
      contentClassName,
      size = "default",
      variant = "default",
      ...props
    },
    ref
  ) => {
    const handleBackdropClick = (e) => {
      if (e.target === e.currentTarget) onClose()
    }

    useEffect(() => {
      if (!isOpen) return
      const handleKeyDown = (e) => {
        if (e.key === "Escape") onClose()
      }
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, onClose])

    const titleId = useId()
    const descId = useId()

    if (!isOpen) return null

    const isSplit = variant === "split"
    // Split consumers render their own title/description and tag the nodes via
    // useModalAria(); the default branch owns its title here. Only reference an
    // id we actually render, so the relationship never dangles.
    const hasOwnTitle = !isSplit && Boolean(title)

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-xs animate-in fade-in-0 duration-200"
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={isSplit || hasOwnTitle ? titleId : undefined}
        aria-describedby={descId}
      >
        <ModalAriaContext.Provider value={{ titleId, descId }}>
          <div
            ref={ref}
            className={cn(
              modalVariants({ size }),
              isSplit && "overflow-hidden",
              className
            )}
            {...props}
          >
            {isSplit ? (
              <div id={descId} className={cn("relative", contentClassName)}>
                {children}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
                  <div className="min-w-0 pt-0.5">
                    <h2
                      id={titleId}
                      className="text-lg sm:text-xl font-semibold leading-tight tracking-tight text-card-foreground"
                    >
                      {title}
                    </h2>
                    {subtitle && (
                      <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                        {subtitle}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-pill bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label="Close modal"
                  >
                    <X size={15} strokeWidth={2.5} />
                  </button>
                </div>
                <div
                  id={descId}
                  className={cn("px-6 pb-6 sm:px-7 sm:pb-7", contentClassName)}
                >
                  {children}
                </div>
              </>
            )}
          </div>
        </ModalAriaContext.Provider>
      </div>
    )
  }
)

Modal.displayName = "Modal"

export { Modal }
