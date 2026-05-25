import * as React from "react"
import { Dialog } from "radix-ui"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const DialogRoot = Dialog.Root
const DialogTrigger = Dialog.Trigger
const DialogClose = Dialog.Close

function DialogPortal({ ...props }) {
  return <Dialog.Portal {...props} />
}

function DialogOverlay({ className, ...props }) {
  return (
    <Dialog.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({ className, overlayClassName, closeButtonClassName, children, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <Dialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-panel border border-border bg-popover p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.8)] dark:shadow-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        <Dialog.Close
          className={cn(
            "absolute right-5 top-5 inline-flex size-8.5 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
            closeButtonClassName,
          )}
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Dialog.Close>
      </Dialog.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 mb-5", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }) {
  return (
    <Dialog.Title
      className={cn("text-lg font-bold text-foreground leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }) {
  return (
    <Dialog.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn("flex justify-end gap-2 mt-6", className)}
      {...props}
    />
  )
}

export {
  DialogRoot,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
}
