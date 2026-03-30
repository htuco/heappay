import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function BadgePreview() {
  return (
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
  )
}
