import CardStatusOverview from '@/components/dashboard/CardStatusOverview'
import TotalBalanceWidget from '@/components/dashboard/TotalBalanceWidget'
import DashboardPlaceholder from '@/components/dashboard/DashboardPlaceholder'
import MoneyFlowPlaceholder from '@/components/dashboard/MoneyFlowPlaceholder'
import QuickActions from '@/components/dashboard/QuickActions'
import { dashboardMockData } from '@/mock-data/dashboardMockData'
import PaymentCard from '@/components/payment-card/PaymentCard'
import {
  buildCardStatusOverviewProps,
  paymentCardMockData,
} from '@/mock-data/paymentCardMockData'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Row 1: Balance (2/3) + Payment Card (1/3) */}
      <section className="grid items-stretch gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <TotalBalanceWidget
            totalBalance={dashboardMockData.balance.totalBalance}
            todaysChange={dashboardMockData.balance.todaysChange}
          />
        </div>
        <div className="flex h-full items-center justify-center">
          <PaymentCard card={paymentCardMockData[0]?.card} />
        </div>
      </section>

      {/* Row 2: Money Flow (2/3) + Quick Actions (1/3) */}
      <section className="grid items-stretch gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MoneyFlowPlaceholder
            points={dashboardMockData.moneyFlow.points}
            labels={dashboardMockData.moneyFlow.labels}
          />
        </div>
        <QuickActions />
      </section>

      {/* Row 3: Card Status (1/3) + Recent Activity (2/3) */}
      <section className="grid items-stretch gap-5 xl:grid-cols-3">
        <CardStatusOverview {...buildCardStatusOverviewProps(paymentCardMockData)} />
        <div className="xl:col-span-2">
          <DashboardPlaceholder
            title="Recent Activity"
            items={dashboardMockData.recentActivity}
          />
        </div>
      </section>
    </div>
  )
}
