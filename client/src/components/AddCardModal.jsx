import * as React from "react"
import Cards from "react-credit-cards-2"
import { Plus, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  detectCardBrand,
  formatCardNumber,
  formattedMaxLength,
  passesLuhn,
  normalizeBrand,
} from "@/utils/paymentCard.utils"
import SplitModal, {
  SplitModalContextLabel,
} from "@/components/ui/SplitModal"
import { useNotifications } from "@/context/NotificationContext"
import { CATEGORIES } from "@/context/notifications/categories"
import { formatBrandLabel } from "@/utils/paymentCard.utils"

const ISSUER_MAP = {
  amex: "american-express",
  "diners-club": "dinersclub",
}

function getIssuer(brand) {
  const key = normalizeBrand(brand?.key)
  return ISSUER_MAP[key] ?? key ?? "unknown"
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

const emptyForm = {
  name: "",
  number: "",
  expiry: "",
  cvv: "",
  cardType: "debit",
  isPrimary: false,
}

function FieldLabel({ htmlFor, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/80"
    >
      {children}
    </label>
  )
}

const inputClass =
  "h-11 w-full rounded-input border border-border bg-background px-3.5 text-base md:text-sm text-card-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
const inputErrorClass =
  "border-destructive focus:border-destructive focus:ring-destructive/20"
const errorTextClass = "mt-1 text-xs font-medium text-destructive"

export default function AddCardModal({
  onSubmit,
  isSubmitting = false,
  submitError = null,
  triggerLabel = "Add New Card",
  triggerClassName,
  triggerVariant,
  open: controlledOpen,
  onOpenChange: onControlledChange,
}) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const [form, setForm] = React.useState(emptyForm)
  const [errors, setErrors] = React.useState({})
  const [focused, setFocused] = React.useState("")
  const { notify } = useNotifications()

  const brand = detectCardBrand(form.number)
  const issuer = getIssuer(brand)
  const expectedCvvLength = brand?.cvvLength ?? 3
  const digits = form.number.replace(/\s/g, "")

  function handleNumberChange(e) {
    const nextBrand = detectCardBrand(e.target.value)
    setForm((f) => ({
      ...f,
      number: formatCardNumber(e.target.value, nextBrand),
      cvv: f.cvv.slice(0, nextBrand?.cvvLength ?? 3),
    }))
  }

  function handleExpiryChange(e) {
    setForm((f) => ({ ...f, expiry: formatExpiry(e.target.value) }))
  }

  function validate() {
    const next = {}
    if (!form.name.trim()) {
      next.name = "Cardholder name is required."
    } else if (
      !/^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[-' ][A-Za-zÀ-ÖØ-öø-ÿ]+)+$/.test(form.name.trim())
    ) {
      next.name =
        "Enter full name as it appears on the card (e.g. John Smith)."
    }
    if (!brand) {
      next.number = "Enter a supported card number."
    } else if (!brand.lengths.includes(digits.length)) {
      next.number = `Enter a valid ${brand.label} card number.`
    } else if (!passesLuhn(digits)) {
      next.number = `${brand.label} card number failed checksum validation.`
    }
    if (!isFutureExpiry(form.expiry))
      next.expiry = "Enter a future expiry in MM/YY format."
    if (form.cvv.length !== expectedCvvLength) {
      next.cvv = `CVV must be exactly ${expectedCvvLength} digits.`
    }
    return next
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
        expiry: form.expiry,
        cvv: form.cvv,
        name: form.name.trim(),
        type: brand?.key ?? "Unknown",
        cardType: form.cardType,
        isPrimary: form.isPrimary,
      })
      const brandLabel = formatBrandLabel(brand?.key) || "Card"
      const tail = digits.slice(-4)
      notify({
        type: "success",
        category: CATEGORIES.SYSTEM,
        message: form.isPrimary
          ? `${brandLabel} •••• ${tail} added as your main card.`
          : `${brandLabel} •••• ${tail} added to your wallet.`,
        link: { route: '/wallet' },
      })
      setForm(emptyForm)
      setErrors({})
      handleOpenChange(false)
    } catch {
      // Parent renders the API error and keeps the dialog open for correction.
    }
  }

  function handleOpenChange(val) {
    if (!isControlled) setInternalOpen(val)
    onControlledChange?.(val)
    if (!val) {
      setForm(emptyForm)
      setErrors({})
      setFocused("")
    }
  }

  const leftPanel = (
    <>
      <div className="flex items-start justify-between gap-3">
        <SplitModalContextLabel>Live preview</SplitModalContextLabel>
        <span className="shrink-0 rounded-pill border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {brand ? brand.label : "Detecting…"}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="add-card-preview add-card-preview--solid">
          <Cards
            number={form.number}
            expiry={form.expiry}
            cvc={form.cvv}
            name={form.name}
            focused={focused}
            issuer={issuer}
            placeholders={{ name: "CARD HOLDER" }}
          />
        </div>
      </div>

      <div className="mt-auto flex items-start gap-2.5 rounded-surface border border-border bg-card p-3.5">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-chip bg-muted text-muted-foreground">
          <ShieldCheck className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-card-foreground">
            Secure card storage
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Your card details are encrypted. CVV is never stored.
          </p>
        </div>
      </div>
    </>
  )

  return (
    <>
      {!isControlled && (
        <Button
          variant={triggerVariant}
          className={triggerClassName}
          onClick={() => handleOpenChange(true)}
        >
          <Plus />
          {triggerLabel}
        </Button>
      )}

      <SplitModal
        isOpen={open}
        onClose={() => handleOpenChange(false)}
        size="3xl"
        className="md:max-w-200"
        gridCols="md:grid-cols-[minmax(0,5fr)_minmax(0,5fr)]"
        eyebrow="New payment card"
        title="Add new card"
        leftPanel={leftPanel}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-card-form"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              size="lg"
            >
              {isSubmitting ? "Adding…" : "Add Card"}
            </Button>
          </>
        }
      >
        <form
          id="add-card-form"
          onSubmit={handleSubmit}
          className="space-y-4"
          noValidate
        >
          <div>
            <FieldLabel htmlFor="card-name">Cardholder Name</FieldLabel>
            <input
              id="card-name"
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value.slice(0, 40) }))
              }
              onFocus={() => setFocused("name")}
              placeholder="Name on card"
              autoComplete="cc-name"
              className={cn(inputClass, errors.name && inputErrorClass)}
            />
            {errors.name && <p className={errorTextClass}>{errors.name}</p>}
          </div>

          <div>
            <FieldLabel htmlFor="card-number">Card Number</FieldLabel>
            <div className="relative">
              <input
                id="card-number"
                type="text"
                value={form.number}
                onChange={handleNumberChange}
                onFocus={() => setFocused("number")}
                placeholder="0000 0000 0000 0000"
                inputMode="numeric"
                maxLength={formattedMaxLength(brand)}
                autoComplete="cc-number"
                className={cn(
                  inputClass,
                  "pr-20 font-mono tracking-wide",
                  errors.number && inputErrorClass
                )}
              />
              {brand && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-chip bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {brand.label}
                </span>
              )}
            </div>
            {errors.number && <p className={errorTextClass}>{errors.number}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="card-expiry">Expiry Date</FieldLabel>
              <input
                id="card-expiry"
                type="text"
                value={form.expiry}
                onChange={handleExpiryChange}
                onFocus={() => setFocused("expiry")}
                placeholder="MM/YY"
                inputMode="numeric"
                maxLength={5}
                autoComplete="cc-exp"
                className={cn(inputClass, errors.expiry && inputErrorClass)}
              />
              {errors.expiry && (
                <p className={errorTextClass}>{errors.expiry}</p>
              )}
            </div>

            <div>
              <FieldLabel htmlFor="card-cvv">CVV</FieldLabel>
              <input
                id="card-cvv"
                type="text"
                value={form.cvv}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    cvv: e.target.value
                      .replace(/\D/g, "")
                      .slice(0, expectedCvvLength),
                  }))
                }
                onFocus={() => setFocused("cvc")}
                onBlur={() => setFocused("")}
                placeholder={"•".repeat(expectedCvvLength)}
                inputMode="numeric"
                maxLength={expectedCvvLength}
                autoComplete="cc-csc"
                className={cn(inputClass, errors.cvv && inputErrorClass)}
              />
              {errors.cvv && <p className={errorTextClass}>{errors.cvv}</p>}
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/80">
              Card Type
            </span>
            <div
              role="radiogroup"
              aria-label="Card type"
              className="inline-flex w-full rounded-input bg-muted p-1 ring-1 ring-border/60"
            >
              {["debit", "credit"].map((type) => {
                const selected = form.cardType === type
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      setForm((f) => ({ ...f, cardType: type }))
                    }
                    className={cn(
                      "flex-1 min-h-11 md:min-h-0 rounded-chip px-3 py-2 text-sm font-semibold capitalize transition-all duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      selected
                        ? "bg-card text-card-foreground shadow-sm ring-1 ring-border"
                        : "text-muted-foreground hover:text-card-foreground"
                    )}
                  >
                    {type}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 rounded-input border border-border bg-muted/40 px-3.5 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-muted/60">
            <input
              type="checkbox"
              checked={form.isPrimary}
              onChange={(e) =>
                setForm((f) => ({ ...f, isPrimary: e.target.checked }))
              }
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Set as primary payment card
          </label>

          {submitError && (
            <p className="rounded-input border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">
              {submitError}
            </p>
          )}
        </form>
      </SplitModal>
    </>
  )
}
