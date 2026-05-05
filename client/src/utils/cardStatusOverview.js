export const cardStatusOverviewTitle = 'Card Status Overview'

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

export function getCardStatusCounts(cards) {
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
    statusCounts: getCardStatusCounts(cards),
  }
}
