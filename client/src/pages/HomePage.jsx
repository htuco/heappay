import { useState } from "react"
import { Modal } from "@/components/ui/modal"

export default function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <div className="space-y-6">
      <section className="rounded-md border p-5 bg-card">
        <h1 className="text-2xl font-semibold mb-3">Modal Demo</h1>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          Open Modal
        </button>
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Demo Modal"
      >
        <p className="text-sm">
          This is a demo modal. Click overlay, ESC, or × to close.
        </p>
      </Modal>
    </div>
  )
}