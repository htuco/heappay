import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

const currencyOptions = [
  { value: 'bam', label: 'BAM — Konvertibilna marka' },
  { value: 'eur', label: 'EUR — Euro' },
  { value: 'usd', label: 'USD — Američki dolar' },
  { value: 'gbp', label: 'GBP — Britanska funta' },
]

export default function SelectPreview() {
  const [currency, setCurrency] = useState('')

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Select</CardTitle>
        <CardDescription>Dropdown za odabir valute</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency-select">Valuta</Label>
          <Select
            id="currency-select"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="Odaberi valutu..."
            options={currencyOptions}
          />
        </div>
        {currency && (
          <p className="text-sm text-muted-foreground">
            Odabrano: <span className="text-foreground font-semibold">{currency.toUpperCase()}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
