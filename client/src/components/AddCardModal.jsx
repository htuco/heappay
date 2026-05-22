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
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogClose,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

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

const labelClass = "mb-1.5 block text-[13px] font-semibold text-slate-900 dark:text-slate-100"
const inputClass =
  "h-[46px] w-full rounded-input border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/12 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#3a3a3a] dark:bg-[#1f1f1f] dark:text-slate-100 dark:placeholder:text-slate-500"
const inputErrorClass = "border-rose-400 focus:border-rose-400 focus:ring-rose-500/15"
const errorTextClass = "mt-1 text-xs text-rose-600 dark:text-rose-400"

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
    } else if (!/^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[-' ][A-Za-zÀ-ÖØ-öø-ÿ]+)+$/.test(form.name.trim())) {
      next.name = "Enter full name as it appears on the card (e.g. John Smith)."
    }
    if (!brand) {
      next.number = "Enter a supported card number."
    } else if (!brand.lengths.includes(digits.length)) {
      next.number = `Enter a valid ${brand.label} card number.`
    } else if (!passesLuhn(digits)) {
      next.number = `${brand.label} card number failed checksum validation.`
    }
    if (!isFutureExpiry(form.expiry)) next.expiry = "Enter a future expiry in MM/YY format."
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

  return (
    <DialogRoot open={open} onOpenChange={handleOpenChange}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant={triggerVariant} className={triggerClassName}>
            <Plus />
            {triggerLabel}
          </Button>
        </DialogTrigger>
      )}

      <DialogContent
        className={cn(
          "w-full max-w-[800px] overflow-hidden rounded-panel border border-slate-200 bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.22)] dark:border-[#3a3a3a] dark:bg-[#262626]"
        )}
      >
        <div className="grid md:grid-cols-[44%_56%]">
          {/* Left — preview column */}
          <aside className="grid grid-rows-[auto_1fr_auto] gap-5 border-b border-slate-200 bg-slate-50 px-7 py-7 md:border-b-0 md:border-r dark:border-[#3a3a3a] dark:bg-[#1f1f1f]">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Live card preview
                </h3>
                <p className="mt-1 text-[13px] leading-snug text-slate-500 dark:text-slate-400">
                  See how your card will appear in your wallet.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:border-[#3a3a3a] dark:bg-[#262626] dark:text-slate-300">
                {brand ? brand.label : "Detecting…"}
              </span>
            </div>

            {/* Card preview panel */}
            <div className="add-card-preview add-card-preview--solid self-center">
              <Cards
                number={form.number}
                expiry={form.expiry}
                cvc={form.cvv}
                name={form.name}
                focused={focused}
                issuer={issuer}
                placeholders={{ name: "CARD HOLDER" }}
                preview={!form.number}
              />
            </div>

            {/* Security block */}
            <div className="flex items-start gap-2.5 rounded-surface border border-slate-200 bg-white p-3.5 dark:border-[#3a3a3a] dark:bg-[#262626]">
              <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-input bg-slate-100 text-slate-600 dark:bg-[#333333] dark:text-slate-300">
                <ShieldCheck className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                  Secure card storage
                </p>
                <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">
                  Your card details are encrypted. CVV is never stored.
                </p>
              </div>
            </div>
          </aside>

          {/* Right — form column */}
          <section className="flex flex-col px-8 py-7">
            <div className="mb-6 pr-12">
              <DialogTitle className="text-[22px] font-bold leading-tight text-slate-900 dark:text-slate-100">
                Add new card
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Enter your card details securely. The preview updates as you type.
              </DialogDescription>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col" noValidate>
              <div className="space-y-4">
                <div>
                  <label htmlFor="card-name" className={labelClass}>
                    Cardholder Name
                  </label>
                  <input
                    id="card-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.slice(0, 40) }))}
                    onFocus={() => setFocused("name")}
                    placeholder="Name on card"
                    autoComplete="cc-name"
                    className={cn(inputClass, errors.name && inputErrorClass)}
                  />
                  {errors.name && <p className={errorTextClass}>{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="card-number" className={labelClass}>
                    Card Number
                  </label>
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
                      className={cn(inputClass, "pr-20", errors.number && inputErrorClass)}
                    />
                    {brand && (
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-chip bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-[#333333] dark:text-slate-300">
                        {brand.label}
                      </span>
                    )}
                  </div>
                  {errors.number && <p className={errorTextClass}>{errors.number}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="card-expiry" className={labelClass}>
                      Expiry Date
                    </label>
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
                    {errors.expiry && <p className={errorTextClass}>{errors.expiry}</p>}
                  </div>

                  <div>
                    <label htmlFor="card-cvv" className={labelClass}>
                      CVV
                    </label>
                    <input
                      id="card-cvv"
                      type="text"
                      value={form.cvv}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          cvv: e.target.value.replace(/\D/g, "").slice(0, expectedCvvLength),
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
                  <span className={labelClass}>Card Type</span>
                  <div
                    role="radiogroup"
                    className="grid h-11 grid-cols-2 gap-1 rounded-input border border-slate-200 bg-slate-50 p-1 dark:border-[#3a3a3a] dark:bg-[#1f1f1f]"
                  >
                    {["debit", "credit"].map((type) => {
                      const selected = form.cardType === type
                      return (
                        <button
                          key={type}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setForm((f) => ({ ...f, cardType: type }))}
                          className={cn(
                            "rounded-chip text-sm capitalize transition-colors",
                            selected
                              ? "bg-white font-semibold text-slate-900 shadow-[0_1px_4px_rgba(15,23,42,0.08)] dark:bg-[#333333] dark:text-slate-100"
                              : "font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                          )}
                        >
                          {type}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 rounded-input border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#3a3a3a] dark:bg-[#1f1f1f] dark:text-slate-300 dark:hover:bg-[#333333]">
                  <input
                    type="checkbox"
                    checked={form.isPrimary}
                    onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                    className="size-4 rounded border-slate-300 accent-blue-500 dark:border-slate-600"
                  />
                  Set as primary payment card
                </label>

                {submitError ? (
                  <p className="rounded-input border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                    {submitError}
                  </p>
                ) : null}
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-[46px] w-full rounded-input bg-slate-900 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  {isSubmitting ? "Adding..." : "Add Card"}
                </button>
                <DialogClose asChild>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="h-[42px] w-full rounded-input bg-transparent text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60 dark:text-slate-400 dark:hover:bg-[#333333] dark:hover:text-slate-100"
                  >
                    Cancel
                  </button>
                </DialogClose>
              </div>
            </form>
          </section>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
