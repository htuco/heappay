import { cn } from "@/lib/utils"

function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-lg border border-border shadow-md p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function CardHeader({ className, children, ...props }) {
  return (
    <div className={cn("flex flex-col gap-1.5 mb-4", className)} {...props}>
      {children}
    </div>
  )
}

function CardTitle({ className, children, ...props }) {
  return (
    <h3
      className={cn("text-lg font-bold leading-none tracking-tight", className)}
      {...props}
    >
      {children}
    </h3>
  )
}

function CardDescription({ className, children, ...props }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props}>
      {children}
    </p>
  )
}

function CardContent({ className, children, ...props }) {
  return (
    <div className={cn("flex flex-col gap-3", className)} {...props}>
      {children}
    </div>
  )
}

function CardFooter({ className, children, ...props }) {
  return (
    <div className={cn("flex items-center gap-3 mt-4", className)} {...props}>
      {children}
    </div>
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
