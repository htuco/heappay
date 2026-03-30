import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function InputPreview() {
  const [name, setName] = useState('')

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Input</CardTitle>
        <CardDescription>Controlled input komponent</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name-input">Ime</Label>
          <Input
            id="name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Unesite ime..."
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Vrijednost: <span className="text-foreground font-semibold">"{name}"</span>
        </p>
      </CardContent>
    </Card>
  )
}
