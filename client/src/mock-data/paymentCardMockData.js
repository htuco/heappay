export const paymentCardMockData = [
  {
    id: 'card-1',
    card: {
      cardHolderName: 'Hamza Tucou',
      cardNumber: '4558 8844 1122 1121',
      expiryDate: '08/30',
      brand: 'visa',
      isActive: true,
      isDisabled: false,
    },
  },
  {
    id: 'card-2',
    card: {
      cardHolderName: 'Dzelila Anjak Tinjo Scrum Master',
      cardNumber: '5555 2312 9999 6512',
      expiryDate: '11/29',
      brand: 'mastercard',
      isActive: false,
      isDisabled: false,
    },
  },
  {
    id: 'card-3',
    card: {
      cardHolderName: 'Nedim Nedimarlija',
      cardNumber: '378282246310005',
      expiryDate: '2029-05-01',
      brand: 'amex',
      isActive: false,
      isDisabled: false,
    },
  },
  {
    id: 'card-4',
    card: {
      cardHolderName: 'DINO BAJRAM0VIC',
      cardNumber: '6011123456789012',
      expiryDate: '09/28',
      brand: 'discover',
      isActive: false,
      isDisabled: true,
    },
  },
]

export const cardStatusOverviewTitle = 'Card Status Overview'

/** Status rows aligned with `card` fields: isActive, isDisabled, and inactive (not active, not disabled). */
export const cardStatusOverviewStatuses = [
  {
    id: 'active',
    label: 'Active',
    icon: 'checkCircle',
  },
  {
    id: 'disabled',
    label: 'Disabled',
    icon: 'alertTriangle',
  },
  {
    id: 'inactive',
    label: 'Inactive',
    icon: 'shieldAlert',
  },
]

export const cardStatusOverviewThemeMap = {
  active: {
    iconWrapperClass: 'bg-primary/10 text-primary',
    chipClass: 'border-primary/25 bg-primary/10 text-primary',
    progressTrackClass: 'bg-primary/15',
    progressBarClass: 'bg-primary',
  },
  disabled: {
    iconWrapperClass: 'bg-destructive/10 text-destructive',
    chipClass: 'border-destructive/25 bg-destructive/10 text-destructive',
    progressTrackClass: 'bg-destructive/15',
    progressBarClass: 'bg-destructive',
  },
  inactive: {
    iconWrapperClass: 'bg-secondary/20 text-secondary-foreground',
    chipClass: 'border-secondary/30 bg-secondary/30 text-secondary-foreground',
    progressTrackClass: 'bg-secondary/30',
    progressBarClass: 'bg-secondary-foreground/70',
  },
}

export function getCardStatusCountsFromPaymentCards(cards) {
  return cards.reduce(
    (counts, item) => {
      if (item.card?.isDisabled) {
        counts.disabled += 1
        return counts
      }

      if (item.card?.isActive) {
        counts.active += 1
        return counts
      }

      counts.inactive += 1
      return counts
    },
    {
      active: 0,
      disabled: 0,
      inactive: 0,
    }
  )
}

export function buildCardStatusOverviewProps(cards) {
  return {
    title: cardStatusOverviewTitle,
    totalCards: cards.length,
    statuses: cardStatusOverviewStatuses,
    statusCounts: getCardStatusCountsFromPaymentCards(cards),
  }
}
