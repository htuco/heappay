import { CARD_SORT_OPTIONS, CARD_STATUS_OPTIONS } from '@/utils/admin.constants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { getCardStatus, getStatusBadgeVariant } from '@/utils/admin.utils'

export default function AdminCardsManagementPanel({
  activeSection,
  activeUserForCards,
  showAllCards,
  cardStatusFilter,
  setCardStatusFilter,
  cardSort,
  setCardSort,
  showCardsForAllUsers,
  focusedUserId,
  unmatchedCards,
  paginatedCards,
  resetAllFilters,
  setFeedbackToast,
  cardPage,
  totalCardPages,
  setCardPage,
}) {
  return (
    <article
      className={`rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5 xl:col-span-5 ${
        activeSection === 'cards' ? 'xl:order-1' : ''
      }`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Cards Management</h2>
          <p className="text-xs text-muted-foreground">Filter card states and review mock actions</p>
          {activeUserForCards && !showAllCards && (
            <p className="mt-1 text-xs text-muted-foreground">
              Cards for: <span className="font-medium text-card-foreground">{activeUserForCards.fullName}</span>
            </p>
          )}
        </div>

        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[1fr_1fr_auto] sm:items-center">
          <Select
            value={cardStatusFilter}
            onChange={(event) => setCardStatusFilter(event.target.value)}
            options={CARD_STATUS_OPTIONS}
            className="sm:w-44"
          />
          <Select
            value={cardSort}
            onChange={(event) => setCardSort(event.target.value)}
            options={CARD_SORT_OPTIONS}
            className="sm:w-36"
          />
          <Button variant="outline" size="sm" onClick={showCardsForAllUsers} disabled={showAllCards}>
            Show all users
          </Button>
        </div>
      </div>

      {focusedUserId && !showAllCards && (
        <p className="mb-3 text-xs text-muted-foreground">
          Showing cards only for selected user from the users table.
        </p>
      )}

      {showAllCards && unmatchedCards.length > 0 && (
        <div className="mb-3 rounded-2xl border border-dashed border-border bg-background/50 p-4 text-xs text-muted-foreground">
          {unmatchedCards.length} card{unmatchedCards.length === 1 ? '' : 's'} from mock data could not be
          matched to any user and are hidden.
        </div>
      )}

      {!showAllCards && !focusedUserId && (
        <div className="mb-3 rounded-2xl border border-dashed border-border bg-background/50 p-4 text-xs text-muted-foreground">
          Select a user row/card to load their cards. Use{' '}
          <span className="font-medium text-card-foreground">View</span> for details.
        </div>
      )}

      {paginatedCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/50 p-6 text-center">
          <p className="font-medium text-card-foreground">No cards found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {!showAllCards && focusedUserId
              ? 'This selected user currently has no matched cards in mock card data.'
              : 'Update user or status filters to see card results.'}
          </p>
          <Button className="mt-4" variant="outline" onClick={resetAllFilters}>
            Reset filters
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {paginatedCards.map((item) => {
              const status = getCardStatus(item.card)

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-card-foreground">{item.ownerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.card.brand.toUpperCase()} •••• {item.card.cardNumber.slice(-4)}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.ownerEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(status)}>{status}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFeedbackToast('Action disabled in demo mode')}
                    >
                      Manage
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCardPage((page) => Math.max(1, page - 1))}
              disabled={cardPage === 1}
            >
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {cardPage} / {totalCardPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCardPage((page) => Math.min(totalCardPages, page + 1))}
              disabled={cardPage === totalCardPages}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </article>
  )
}
