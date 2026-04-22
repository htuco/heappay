import CardList from '@/components/card-view/CardList'

export default function AdminCardPreviewSection({ items }) {
  return (
    <article className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 xl:col-span-12">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-card-foreground">Card Preview Grid</h2>
        <p className="text-xs text-muted-foreground">Reused from card view components</p>
      </div>
      <CardList items={items} />
    </article>
  )
}
