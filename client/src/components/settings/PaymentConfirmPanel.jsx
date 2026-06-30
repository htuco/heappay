import ControlRow from '@/components/settings/ControlRow'
import OptionGroup from '@/components/settings/OptionGroup'
import Toggle from '@/components/settings/Toggle'
import { Input } from '@/components/ui/input'

const MODES = ['Every payment', 'Above amount']

function resolveMode(aboveAmount) {
  const threshold = Number(aboveAmount ?? 0)
  return threshold <= 0 ? 'Every payment' : 'Above amount'
}

export default function PaymentConfirmPanel({
  enabled,
  aboveAmount,
  onEnabledChange,
  onAboveAmountChange,
  disabled = false,
}) {
  const mode = resolveMode(aboveAmount)

  function handleModeSelect(label) {
    if (label === 'Every payment') {
      onAboveAmountChange('0')
      return
    }
    const current = Number(aboveAmount)
    onAboveAmountChange(String(current > 0 ? current : 10))
  }

  return (
    <div className="space-y-3">
      <ControlRow
        label="Confirm before sending"
        hint="Require Face ID, app PIN, authenticator, or password before outbound payments."
        emphasize
        alignToggle
      >
        <Toggle
          compact
          enabled={enabled}
          label="Confirm before sending"
          onToggle={() => onEnabledChange(!enabled)}
          disabled={disabled}
        />
      </ControlRow>

      {enabled ? (
        <>
          <ControlRow
            label="When to confirm"
            hint="Choose whether every send needs verification or only larger amounts."
          >
            <OptionGroup
              options={MODES}
              active={mode}
              onSelect={handleModeSelect}
            />
          </ControlRow>

          {mode === 'Above amount' ? (
            <ControlRow
              label="Confirm above"
              hint="Payments at or above this amount require verification."
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={aboveAmount}
                  onChange={(e) => onAboveAmountChange(e.target.value.replace(/[^\d.]/g, ''))}
                  disabled={disabled}
                  className="max-w-28"
                  aria-label="Confirm above amount"
                />
              </div>
            </ControlRow>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
