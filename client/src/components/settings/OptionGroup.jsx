export default function OptionGroup({ options, active, onSelect }) {
  return (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          aria-pressed={option === active}
          className={`rounded-input border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
            option === active
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-card-foreground'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
