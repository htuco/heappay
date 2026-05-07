import { cn } from "@/lib/utils"

const badgeClasses = {
  default: "bg-primary text-primary-foreground border-border",
  success: "bg-success text-success-foreground border-success",
  warning: "bg-warning text-warning-foreground border-warning",
  error:   "bg-destructive text-destructive-foreground border-destructive",
  info:    "bg-info text-info-foreground border-info",
  secondary: "bg-secondary text-secondary-foreground border-border",
  outline: "bg-transparent text-foreground border-border",
}

const badgeSizes = {
  sm: "px-1.5 py-0 text-xs",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
}

function Badge({ variant = "default", size = "md", className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border-2 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)] dark:shadow-none transition-all",
        badgeClasses[variant],
        badgeSizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { Badge }
