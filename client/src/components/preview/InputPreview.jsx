import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function InputPreview({ label = "Input", placeholder = "Enter a value...", type = "text", disabled = false }) {
  const [value, setValue] = useState('')

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Input</CardTitle>
        <CardDescription>Controlled input component</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="preview-input">{label}</Label>
          <Input
            id="preview-input"
            type={type}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Value: <span className="text-foreground font-semibold">"{value}"</span>
        </p>
      </CardContent>
    </Card>
  )
}
