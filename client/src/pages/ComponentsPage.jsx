import ButtonPreview from '@/components/preview/ButtonPreview'
import BadgePreview from '@/components/preview/BadgePreview'
import SelectPreview from '@/components/preview/SelectPreview'
import InputPreview from '@/components/preview/InputPreview'
import FormPreview from '@/components/preview/FormPreview'

export default function ComponentsPage() {
  return (
    <div className="p-6 flex flex-col gap-8">
      <h1 className="text-3xl font-bold">UI Components Preview</h1>
      <ButtonPreview />
      <BadgePreview />
      <SelectPreview />
      <InputPreview />
      <FormPreview />
    </div>
  )
}
