import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export default function ButtonPreview() {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Button</CardTitle>
        <CardDescription>Sve varijante dugmeta</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => alert('Default!')}>Default</Button>
          <Button variant="outline" onClick={() => alert('Outline!')}>Outline</Button>
          <Button variant="secondary" onClick={() => alert('Secondary!')}>Secondary</Button>
          <Button variant="destructive" onClick={() => alert('Destructive!')}>Destructive</Button>
          <Button variant="ghost" onClick={() => alert('Ghost!')}>Ghost</Button>
        </div>
      </CardContent>
    </Card>
  )
}
