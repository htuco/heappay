import { useState, useEffect } from 'react'
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { getRoleBadgeVariant } from '@/utils/admin.utils'

export default function UserDetailsDialog({ selectedUser, setSelectedUser, userRoles, userStatuses, onSave, isAdmin }) {
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [selectedStatusId, setSelectedStatusId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (selectedUser) {
      setSelectedRoleId(String(selectedUser.roleId ?? ''))
      setSelectedStatusId(String(selectedUser.statusId ?? ''))
      setError('')
    }
  }, [selectedUser])

  async function handleSave() {
    setIsSaving(true)
    setError('')
    try {
      await onSave(selectedUser.id, {
        user_role_id: Number(selectedRoleId),
        status_id: Number(selectedStatusId),
      })
    } catch (err) {
      setError(err?.message || 'Failed to update user.')
      setIsSaving(false)
      return
    }
    setIsSaving(false)
  }

  const roleOptions = userRoles.map((r) => ({ value: String(r.role_id), label: r.role_name }))
  const statusOptions = userStatuses.map((s) => ({ value: String(s.id), label: s.status_name }))

  return (
    <DialogRoot open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            View and manage user information.
          </DialogDescription>
        </DialogHeader>

        {selectedUser && (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-2xl border border-border bg-background p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Name</p>
                <p className="mt-1 font-medium text-card-foreground">{selectedUser.fullName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Email</p>
                <p className="mt-1 font-medium text-card-foreground">{selectedUser.email}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Role</p>
                <div className="mt-1">
                  <Badge variant={getRoleBadgeVariant(selectedUser.role)}>{selectedUser.role}</Badge>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Status</p>
                <div className="mt-1">
                  <Badge variant={selectedUser.status === 'active' ? 'success' : 'warning'}>
                    {selectedUser.status}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Cards</p>
                <p className="mt-1 font-medium text-card-foreground">{selectedUser.cards.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Active Cards</p>
                <p className="mt-1 font-medium text-card-foreground">
                  {selectedUser.cards.filter((item) => item.card.isActive && !item.card.isDisabled).length}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Last Login</p>
                <p className="mt-1 font-medium text-card-foreground">{selectedUser.lastLogin}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Edit User</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Role</label>
                  <Select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    options={roleOptions}
                    disabled={!isAdmin || isSaving}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Status</label>
                  <Select
                    value={selectedStatusId}
                    onChange={(e) => setSelectedStatusId(e.target.value)}
                    options={statusOptions}
                    disabled={!isAdmin || isSaving}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => setSelectedUser(null)} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="default" onClick={handleSave} disabled={!isAdmin || isSaving}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
