import { cn } from "@/lib/utils"

function Select({ id, value, onChange, placeholder, options = [], className, ...props }) {
  return (
    <select
      id={id}
      value={value}
      onChange={onChange}
      className={cn(
        "w-full rounded-lg border-2 border-border bg-input px-3 py-2 text-sm font-medium text-foreground outline-none transition-all appearance-none cursor-pointer",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:shadow-md",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export { Select }
