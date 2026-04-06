import ButtonPreview from '@/components/preview/ButtonPreview'
import BadgePreview from '@/components/preview/BadgePreview'
import SelectPreview from '@/components/preview/SelectPreview'
import InputPreview from '@/components/preview/InputPreview'
import FormPreview from '@/components/preview/FormPreview'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

const TRANSACTIONS = [
  { id: 1, description: 'Netflix subscription',   amount: '-$15.99',  status: 'success' },
  { id: 2, description: 'Salary deposit',          amount: '+$3,200',  status: 'success' },
  { id: 3, description: 'Amazon purchase',         amount: '-$89.00',  status: 'pending' },
  { id: 4, description: 'Transfer to savings',     amount: '-$500.00', status: 'error'   },
]

export default function ComponentsPage() {
  return (
    <div className="p-6 flex flex-col gap-8">
      <h1 className="text-3xl font-bold">UI Components</h1>

      <div className="flex flex-wrap gap-4">
        <BadgePreview variant="success" />
        <BadgePreview variant="error" size="lg" />
        <BadgePreview variant="warning" label="Pending" />
        <BadgePreview variant="info" size="sm" />
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between">
              <span className="text-sm">{tx.description}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{tx.amount}</span>
                <Badge variant={tx.status}>{tx.status}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4">
        <ButtonPreview variant="default" label="Save" />
        <ButtonPreview variant="destructive" label="Delete" />
        <ButtonPreview variant="outline" label="Cancel" />
        <ButtonPreview variant="default" label="Disabled" disabled />
      </div>

      <div className="flex flex-wrap gap-4">
        <InputPreview label="Name" placeholder="Enter your name..." />
        <InputPreview label="Password" type="password" placeholder="Enter your password..." />
        <InputPreview label="Disabled" disabled />
      </div>

      <SelectPreview label="Currency" placeholder="Select currency..." />

      <FormPreview submitLabel="Submit" cancelLabel="Cancel" />
    </div>
  )
}
