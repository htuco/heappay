import { cn } from "@/lib/utils"

function Label({ htmlFor, children, className, ...props }) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "text-sm font-bold text-foreground leading-none tracking-tight",
        className
      )}
      {...props}
    >
      {children}
    </label>
  )
}

export { Label }
