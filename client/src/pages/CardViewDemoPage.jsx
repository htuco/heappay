import { useState } from 'react'
import CardCollectionView from '@/components/card-view/CardCollectionView'
import { paymentCardMockData } from '@/mock-data/paymentCardMockData'
import { Button } from '@/components/ui/button'

export default function CardViewDemoPage() {
  const [variant, setVariant] = useState('carousel')

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h1 className="text-2xl font-semibold text-card-foreground">Card View Demo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toggle list vs carousel. Carousel is a placeholder until wiring is added.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={variant === 'carousel' ? 'default' : 'outline'}
            onClick={() => setVariant('carousel')}
          >
            Carousel
          </Button>
          <Button
            type="button"
            variant={variant === 'list' ? 'default' : 'outline'}
            onClick={() => setVariant('list')}
          >
            List
          </Button>
        </div>
      </section>

      <CardCollectionView variant={variant} items={paymentCardMockData} />
    </div>
  )
}
