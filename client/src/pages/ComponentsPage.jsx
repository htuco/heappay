import ButtonPreview from '@/components/preview/ButtonPreview'
import BadgePreview from '@/components/preview/BadgePreview'
import SelectPreview from '@/components/preview/SelectPreview'
import InputPreview from '@/components/preview/InputPreview'
import FormPreview from '@/components/preview/FormPreview'
import AddCardModal from '@/components/AddCardModal'
import CardActionsMenu from '@/components/CardActionsMenu'

export default function ComponentsPage() {
  return (
    <div className="p-6 flex flex-col gap-8">
      <h1 className="text-3xl font-bold">UI Components Preview</h1>
      <ButtonPreview />
      <BadgePreview />
      <SelectPreview />
      <InputPreview />
      <FormPreview />

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Add Card Modal</h2>
        <div>
          <AddCardModal onSubmit={(data) => console.log("Card submitted:", data)} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-bold">Card Actions Menu</h2>
        <p className="text-sm text-muted-foreground">Active card / Inactive card</p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Active card:</span>
            <CardActionsMenu
              isActive={true}
              onDeactivate={() => console.log("Deactivate")}
              onArchive={() => console.log("Archive")}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Inactive card:</span>
            <CardActionsMenu
              isActive={false}
              onDeactivate={() => console.log("Reactivate")}
              onArchive={() => console.log("Archive")}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
