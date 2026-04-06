import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

const DEFAULT_OPTIONS = [
  { value: 'bam', label: 'BAM — Bosnian Mark' },
  { value: 'eur', label: 'EUR — Euro' },
  { value: 'usd', label: 'USD — US Dollar' },
  { value: 'gbp', label: 'GBP — British Pound' },
]

export default function SelectPreview({ label = "Select", placeholder = "Choose an option...", options = DEFAULT_OPTIONS, disabled = false }) {
  const [value, setValue] = useState('')

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Select</CardTitle>
        <CardDescription>Dropdown component</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="preview-select">{label}</Label>
          <Select
            id="preview-select"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            options={options}
            disabled={disabled}
          />
        </div>
        {value && (
          <p className="text-sm text-muted-foreground">
            Selected: <span className="text-foreground font-semibold">{value.toUpperCase()}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
