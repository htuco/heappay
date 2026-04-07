import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"

export default function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const openModal = useCallback(() => setIsModalOpen(true), [])
  const closeModal = useCallback(() => setIsModalOpen(false), [])

  return (
    <div className="space-y-6">
      <section className="rounded-md border p-5 bg-card">
        <h1 className="text-2xl font-semibold mb-3">Modal Demo</h1>

        <Button type="button" onClick={openModal}>
          Open Modal
        </Button>
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title="Demo Modal"
      >
        <p className="text-sm">
          This is a demo modal. Click overlay, ESC, or × to close.
        </p>
      </Modal>
    </div>
  )
}