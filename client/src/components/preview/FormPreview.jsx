import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

export default function FormPreview({ submitLabel = "Submit", cancelLabel = "Cancel", onSubmit, onCancel }) {
  const [email, setEmail] = useState('')

  function handleSubmit() {
    if (onSubmit) onSubmit(email)
    else alert(`Email: ${email}`)
  }

  function handleCancel() {
    setEmail('')
    if (onCancel) onCancel()
  }

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Form example</CardTitle>
        <CardDescription>Label + Input + Button combined</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email-input">Email address</Label>
          <Input
            id="email-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. user@email.com"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Click on the "Email address" label — input gets focus (htmlFor works)
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSubmit}>{submitLabel}</Button>
        <Button variant="outline" onClick={handleCancel}>{cancelLabel}</Button>
      </CardFooter>
    </Card>
  )
}
