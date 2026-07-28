import { useState } from 'react'
import { Loader2, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import UserAvatar from '@/components/ui/UserAvatar'
import useUserSearch from '@/hooks/useUserSearch'
import { inviteDependent } from '@/services/familyService'

export default function InviteDependentModal({ open, onOpenChange, currentUserId, onInvited }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { results, isLoading: searching, error: searchError } = useUserSearch(query)

  const showResults = query.trim().length >= 3 && !selected

  function reset() {
    setQuery('')
    setSelected(null)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const email = selected?.email ?? query.trim()
    if (!email) return
    setLoading(true)
    setError('')
    try {
      const link = await inviteDependent(email)
      onInvited?.(link)
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err?.message || 'Could not send this invite.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogRoot
      open={open}
      onOpenChange={(o) => {
        if (!o) reset()
        onOpenChange(o)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a dependent</DialogTitle>
          <DialogDescription>
            Search by email for an existing Heap account. They'll need to accept before you can
            set an allowance, spending limits, or manage their cards.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Input
              value={selected?.email ?? query}
              onChange={(e) => {
                setSelected(null)
                setQuery(e.target.value)
              }}
              placeholder="name@example.com"
              inputMode="email"
              className="pr-10"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Search className="h-4 w-4 text-muted-foreground" />
              )}
            </span>
          </div>

          {showResults ? (
            <div className="max-h-56 overflow-y-auto rounded-surface border border-border bg-card shadow-sm">
              {searching ? (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              ) : searchError ? (
                <p className="px-3 py-3 text-sm text-destructive">{searchError}</p>
              ) : results.filter((u) => u.user_id !== currentUserId).length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">No accounts found.</p>
              ) : (
                results
                  .filter((u) => u.user_id !== currentUserId)
                  .map((user) => (
                    <button
                      key={user.user_id}
                      type="button"
                      onClick={() => setSelected(user)}
                      className="flex min-h-11 w-full items-center gap-3 px-3 py-3 text-left transition-colors touch-manipulation hover:bg-muted/40"
                    >
                      <UserAvatar user={user} className="h-9 w-9 text-xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-card-foreground">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </button>
                  ))
              )}
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={loading || (!selected && !query.trim())}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </DialogRoot>
  )
}
