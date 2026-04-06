import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function BadgePreview({ variant = "default", size = "md", label }) {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Badge</CardTitle>
        <CardDescription>Badge component</CardDescription>
      </CardHeader>
      <CardContent>
        <Badge variant={variant} size={size}>{label ?? variant}</Badge>
      </CardContent>
    </Card>
  )
}
