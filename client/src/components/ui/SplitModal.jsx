import { X } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { useModalAria } from '@/components/ui/modal-context'
import { cn } from '@/lib/utils'

/**
 * SplitModal — reusable 2-part modal shell.
 *
 * Left:  contextual / preview panel (muted background).
 * Right: interactive form area with eyebrow, title, content and sticky footer.
 *
 * Collapses to single column (right side only) on <md.
 */
export default function SplitModal({
  isOpen,
  onClose,
  size = '3xl',
  eyebrow,
  title,
  leftPanel,
  children,
  footer,
  className,
  rightClassName,
  leftClassName,
  minHeight = 'min-h-128',
  gridCols = 'md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]',
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="split"
      size={size}
      className={className}
    >
      <SplitModalBody
        onClose={onClose}
        eyebrow={eyebrow}
        title={title}
        leftPanel={leftPanel}
        footer={footer}
        rightClassName={rightClassName}
        leftClassName={leftClassName}
        minHeight={minHeight}
        gridCols={gridCols}
      >
        {children}
      </SplitModalBody>
    </Modal>
  )
}

// Rendered inside <Modal>, so it can read the modal's generated aria ids and
// tag its own <h2> as the labelling node (no hardcoded shared id).
function SplitModalBody({
  onClose,
  eyebrow,
  title,
  leftPanel,
  children,
  footer,
  rightClassName,
  leftClassName,
  minHeight,
  gridCols,
}) {
  const aria = useModalAria()

  return (
    <div className={cn('grid', gridCols)}>
      {leftPanel && (
        <aside
          className={cn(
            'hidden flex-col gap-5 bg-muted/40 p-6 md:flex',
            leftClassName
          )}
        >
          {leftPanel}
        </aside>
      )}

      <div
        className={cn(
          'flex flex-col px-6 pt-5 pb-6 sm:px-7 sm:pb-7',
          minHeight,
          rightClassName
        )}
      >
        <header className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2
                id={aria?.titleId}
                className={cn(
                  'text-base font-semibold leading-tight text-card-foreground',
                  eyebrow && 'mt-1'
                )}
              >
                {title}
              </h2>
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
        </header>

        <div className="flex-1">{children}</div>

        {footer && (
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * SplitModalContextLabel — small uppercase label used to title sections
 * inside the left contextual panel.
 */
export function SplitModalContextLabel({ children, className }) {
  return (
    <p
      className={cn(
        'text-[10px] font-bold uppercase tracking-widest text-muted-foreground',
        className
      )}
    >
      {children}
    </p>
  )
}
