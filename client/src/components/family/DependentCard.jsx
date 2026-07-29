import { useState } from 'react'
import { Loader2, Send, Sliders, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import UserAvatar from '@/components/ui/UserAvatar'
import { sendAllowance } from '@/services/familyService'

export default function DependentCard({
  link,
  onOpenLimits,
  onOpenCards,
  onRevoke,
  busy = false,
}) {
  const dependent = link.dependent
  const [allowanceOpen, setAllowanceOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sentBalance, setSentBalance] = useState(null)

  function closeAllowance() {
    setAllowanceOpen(false)
    setAmount('')
    setError('')
    setSentBalance(null)
  }

  async function handleSendAllowance(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await sendAllowance(dependent.user_id, amount)
      setSentBalance(result.dependent_wallet_balance)
      setAmount('')
    } catch (err) {
      setError(err?.message || 'Could not send this allowance.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-card border border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar user={dependent} className="h-10 w-10 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-card-foreground">
              {dependent.first_name} {dependent.last_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">{dependent.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-destructive hover:text-destructive"
          title="Remove family link"
          disabled={busy}
          onClick={() => onRevoke(link)}
        >
          <XCircle className="size-4" />
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setAllowanceOpen(true)}>
          <Send className="mr-1.5 size-3.5" />
          Send allowance
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenLimits(link)}>
          <Sliders className="mr-1.5 size-3.5" />
          Spending limits
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenCards(link)}>
          Cards
        </Button>
      </div>

      <DialogRoot open={allowanceOpen} onOpenChange={(o) => !o && closeAllowance()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Send allowance to {dependent.first_name} {dependent.last_name}
            </DialogTitle>
            <DialogDescription>
              Moves money from your wallet balance into theirs.
            </DialogDescription>
          </DialogHeader>
          {sentBalance != null ? (
            <p className="text-sm text-success">
              Sent. Their wallet balance is now ${Number(sentBalance).toFixed(2)}.
            </p>
          ) : (
            <form onSubmit={handleSendAllowance} className="space-y-3">
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                autoFocus
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={loading}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={loading || !amount}>
                  {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Send
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </DialogRoot>
    </div>
  )
}
