import * as React from "react"
import { Ban, CheckCircle, Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

export default function CardActionsMenu({ isActive = true, onDeactivate, onArchive }) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  function handleArchiveConfirm() {
    onArchive?.()
    setConfirmOpen(false)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onDeactivate?.()}>
          {isActive ? (
            <>
              <Ban />
              Deactivate
            </>
          ) : (
            <>
              <CheckCircle />
              Reactivate
            </>
          )}
        </Button>

        <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
          <Trash2 />
          Archive
        </Button>
      </div>

      <DialogRoot open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-1">
              <AlertTriangle className="size-5 shrink-0" />
              <DialogTitle className="text-destructive">Archive this card?</DialogTitle>
            </div>
            <DialogDescription>
              This will permanently remove the card from your wallet. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleArchiveConfirm}>
              <Trash2 />
              Archive Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  )
}
