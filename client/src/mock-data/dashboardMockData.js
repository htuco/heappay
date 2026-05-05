export const dashboardMockData = {
  balance: {
    totalBalance: '$12,450.00',
    todaysChange: '$3,154.52',
  },
  moneyFlow: {
    points: [7800, 10200, 11400, 11000, 12600, 12300],
    labels: ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'],
  },
  recentActivity: [
    {
      id: 'act-1',
      title: 'Payment received from Acme Corp',
      timestamp: 'Today, 2:30 PM',
      amount: '+$3,500',
      direction: 'in',
    },
    {
      id: 'act-2',
      title: 'AWS Cloud Services',
      timestamp: 'Yesterday, 4:15 PM',
      amount: '-$289',
      direction: 'out',
    },
    {
      id: 'act-3',
      title: 'Monthly retainer - TechStart',
      timestamp: 'May 2, 10:00 AM',
      amount: '+$5,000',
      direction: 'in',
    },
  ],
}
