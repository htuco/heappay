import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { getRoleBadgeVariant } from '@/utils/admin.utils'

export default function UserDetailsDialog({ selectedUser, setSelectedUser }) {
  return (
    <DialogRoot open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            Preview mock user information and assigned cards for admin review.
          </DialogDescription>
        </DialogHeader>

        {selectedUser && (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-2xl border border-border bg-background p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Name</p>
                <p className="mt-1 font-medium text-card-foreground">{selectedUser.fullName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Email</p>
                <p className="mt-1 font-medium text-card-foreground">{selectedUser.email}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Role</p>
                <div className="mt-1">
                  <Badge variant={getRoleBadgeVariant(selectedUser.role)}>{selectedUser.role}</Badge>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                <div className="mt-1">
                  <Badge variant={selectedUser.status === 'active' ? 'success' : 'warning'}>
                    {selectedUser.status}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Cards</p>
                <p className="mt-1 font-medium text-card-foreground">{selectedUser.cards.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Active Cards</p>
                <p className="mt-1 font-medium text-card-foreground">
                  {selectedUser.cards.filter((item) => item.card.isActive && !item.card.isDisabled).length}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Last Login</p>
                <p className="mt-1 font-medium text-card-foreground">{selectedUser.lastLogin}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                User Cards (Miniature)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedUser.cards.map((item) => (
                  <article
                    key={`${selectedUser.id}-${item.id}`}
                    className="rounded-2xl border border-border bg-card p-3"
                  >
                    <p className="text-sm font-semibold text-card-foreground">{item.card.cardHolderName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.card.brand.toUpperCase()} •••• {item.card.cardNumber.slice(-4)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">Expires {item.card.expiryDate}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </DialogRoot>
  )
}
