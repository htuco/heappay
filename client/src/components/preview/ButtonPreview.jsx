import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function ButtonPreview({ variant = "default", size = "md", disabled = false, label, onClick }) {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Button</CardTitle>
        <CardDescription>Button component</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant={variant} size={size} disabled={disabled} onClick={onClick}>
          {label ?? variant}
        </Button>
      </CardContent>
    </Card>
  )
}
