import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'

const currencyOptions = [
  { value: 'bam', label: 'BAM — Konvertibilna marka' },
  { value: 'eur', label: 'EUR — Euro' },
  { value: 'usd', label: 'USD — Američki dolar' },
  { value: 'gbp', label: 'GBP — Britanska funta' },
]

export default function ComponentsPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('')

  return (
    <div className="p-6 flex flex-col gap-8">
      <h1 className="text-3xl font-bold">UI Components Preview</h1>

      {/* Button kartica */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Button</CardTitle>
          <CardDescription>Sve varijante dugmeta</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button text="Default" onClick={() => alert('Default!')} />
            <Button variant="outline" text="Outline" onClick={() => alert('Outline!')} />
            <Button variant="secondary" text="Secondary" onClick={() => alert('Secondary!')} />
            <Button variant="destructive" text="Destructive" onClick={() => alert('Destructive!')} />
            <Button variant="ghost" text="Ghost" onClick={() => alert('Ghost!')} />
          </div>
        </CardContent>
      </Card>

      {/* Badge kartica */}
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Badge</CardTitle>
          <CardDescription>Varijante i veličine</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs font-bold text-muted-foreground mb-1">VARIJANTE</p>
          <div className="flex flex-wrap gap-3 mb-4">
            <Badge variant="success">success</Badge>
            <Badge variant="warning">warning</Badge>
            <Badge variant="error">error</Badge>
            <Badge variant="info">info</Badge>
            <Badge variant="default">default</Badge>
            <Badge variant="secondary">secondary</Badge>
            <Badge variant="outline">outline</Badge>
          </div>
          <p className="text-xs font-bold text-muted-foreground mb-1">VELIČINE</p>
          <div className="flex items-center flex-wrap gap-3">
            <Badge variant="success" size="sm">sm</Badge>
            <Badge variant="success" size="md">md</Badge>
            <Badge variant="success" size="lg">lg</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Select kartica */}
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

      {/* Input kartica */}
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

      {/* Form kartica — Label + Input + Button zajedno */}
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>Form primjer</CardTitle>
          <CardDescription>Label + Input + Button zajedno</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email-input">Email adresa</Label>
            <Input
              id="email-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="npr. korisnik@email.com"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Klikni na "Email adresa" tekst — input dobija fokus (htmlFor radi)
          </p>
        </CardContent>
        <CardFooter>
          <Button text="Pošalji" onClick={() => alert(`Email: ${email}`)} />
          <Button variant="outline" text="Odustani" onClick={() => setEmail('')} />
        </CardFooter>
      </Card>
    </div>
  )
}
