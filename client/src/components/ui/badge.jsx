import { cn } from "@/lib/utils"

const badgeStyles = {
  default: { background: undefined, color: undefined, borderColor: undefined },
  success: { background: "#22c55e", color: "#ffffff", borderColor: "#15803d" },
  warning: { background: "#b45309", color: "#ffffff", borderColor: "#78350f" },
  error:   { background: "#dc2626", color: "#ffffff", borderColor: "#7f1d1d" },
  info:    { background: "#2563eb", color: "#ffffff", borderColor: "#1e3a8a" },
  secondary: { background: undefined, color: undefined, borderColor: undefined },
  outline: { background: "transparent", color: undefined, borderColor: undefined },
}

const badgeClasses = {
  default: "bg-primary text-primary-foreground border-border",
  success: "border-2",
  warning: "border-2",
  error:   "border-2",
  info:    "border-2",
  secondary: "bg-secondary text-secondary-foreground border-border",
  outline: "text-foreground border-border",
}

const badgeSizes = {
  sm: "px-1.5 py-0 text-xs",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
}

function Badge({ variant = "default", size = "md", className, children, ...props }) {
  return (
    <span
      style={badgeStyles[variant]}
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
