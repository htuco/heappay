import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

export default function FormPreview() {
  const [email, setEmail] = useState('')

  return (
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
        <Button onClick={() => alert(`Email: ${email}`)}>Pošalji</Button>
        <Button variant="outline" onClick={() => setEmail('')}>Odustani</Button>
      </CardFooter>
    </Card>
  )
}
