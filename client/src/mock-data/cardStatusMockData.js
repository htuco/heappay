export const cardStatusMockData = {
  title: 'Card Status Overview',
  totalCards: 3,
  statuses: [
    {
      id: 'active',
      label: 'Active',
      icon: 'checkCircle',
      toneClass: 'from-blue-500 via-indigo-500 to-purple-500',
    },
    {
      id: 'blocked',
      label: 'Blocked',
      icon: 'alertTriangle',
      toneClass: 'from-orange-500 via-orange-600 to-red-500',
    },
    {
      id: 'reported',
      label: 'Reported',
      icon: 'shieldAlert',
      toneClass: 'from-zinc-700 via-zinc-800 to-rose-900',
    },
  ],
  statusCounts: {
    active: 1,
    blocked: 1,
    reported: 1,
  },
}
