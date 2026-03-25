import { cn } from "@/lib/utils"

function Input({ id, value, onChange, placeholder, className, ...props }) {
  return (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-lg border-2 border-border bg-input px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none transition-all focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:shadow-md disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Input }
