import * as React from "react"
import { CreditCard, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

function detectCardType(number) {
  const raw = number.replace(/\s/g, "")
  if (/^4/.test(raw)) return "Visa"
  if (/^5[1-5]/.test(raw) || /^2(2[2-9][1-9]|[3-6]\d{2}|7[01]\d|720)/.test(raw)) return "Mastercard"
  return null
}

function formatCardNumber(value) {
  const digits = value.replace(/\D/g, "").slice(0, 16)
  return digits.replace(/(.{4})/g, "$1 ").trim()
}

function formatExpiry(value) {
  const digits = value.replace(/\D/g, "").slice(0, 4)
  if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2)
  return digits
}

function isFutureExpiry(value) {
  const match = value.match(/^(\d{2})\/(\d{2})$/)
  if (!match) return false

  const month = Number(match[1])
  if (month < 1 || month > 12) return false

  const year = 2000 + Number(match[2])
  const expiryDate = new Date(year, month, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return expiryDate > today
}

const emptyForm = { number: "", name: "", expiry: "", cvv: "" }

export default function AddCardModal({ onSubmit, isSubmitting = false, submitError = null }) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)
  const [errors, setErrors] = React.useState({})

  const cardType = detectCardType(form.number)

  function handleNumberChange(e) {
    setForm((f) => ({ ...f, number: formatCardNumber(e.target.value) }))
  }

  function handleExpiryChange(e) {
    setForm((f) => ({ ...f, expiry: formatExpiry(e.target.value) }))
  }

  function validate() {
    const e = {}
    if (form.number.replace(/\s/g, "").length < 16) e.number = "Enter a valid 16-digit card number."
    if (!form.name.trim()) e.name = "Cardholder name is required."
    if (!isFutureExpiry(form.expiry)) e.expiry = "Enter a future expiry in MM/YY format."
    if (form.cvv.length !== 3) e.cvv = "CVV must be exactly 3 digits."
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    try {
      await onSubmit?.({
        number: form.number,
        name: form.name,
        expiry: form.expiry,
        cvv: form.cvv,
        type: cardType ?? "Unknown",
      })
      setForm(emptyForm)
      setErrors({})
      setOpen(false)
    } catch {
      // Parent renders the API error and keeps the dialog open for correction.
    }
  }

  function handleOpenChange(val) {
    setOpen(val)
    if (!val) {
      setForm(emptyForm)
      setErrors({})
    }
  }

  return (
    <DialogRoot open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add New Card
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Card</DialogTitle>
          <DialogDescription>Enter your card details below. CVV is never stored.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

          {/* Card number */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="card-number">Card Number</Label>
              {cardType && (
                <Badge variant={cardType === "Visa" ? "info" : "default"} size="sm">
                  {cardType === "Visa" ? "VISA" : "MASTERCARD"}
                </Badge>
              )}
            </div>
            <div className="relative">
              <Input
                id="card-number"
                value={form.number}
                onChange={handleNumberChange}
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                maxLength={19}
                className={errors.number ? "border-destructive" : ""}
              />
              <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            </div>
            {errors.number && <p className="text-xs text-destructive">{errors.number}</p>}
          </div>

          {/* Cardholder name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="card-name">Cardholder Name</Label>
            <Input
              id="card-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="John Doe"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* Expiry + CVV */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-expiry">Expiry Date</Label>
              <Input
                id="card-expiry"
                value={form.expiry}
                onChange={handleExpiryChange}
                placeholder="MM/YY"
                inputMode="numeric"
                maxLength={5}
                className={errors.expiry ? "border-destructive" : ""}
              />
              {errors.expiry && <p className="text-xs text-destructive">{errors.expiry}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="card-cvv">CVV</Label>
              <Input
                id="card-cvv"
                type="password"
                value={form.cvv}
                onChange={(e) => setForm((f) => ({ ...f, cvv: e.target.value.replace(/\D/g, "").slice(0, 3) }))}
                placeholder="•••"
                inputMode="numeric"
                maxLength={3}
                className={errors.cvv ? "border-destructive" : ""}
              />
              {errors.cvv && <p className="text-xs text-destructive">{errors.cvv}</p>}
            </div>
          </div>

          {submitError ? (
            <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Card"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  )
}
