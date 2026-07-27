import { useState } from 'react'
import { Loader2, Search, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import UserAvatar from '@/components/ui/UserAvatar'
import useUserSearch from '@/hooks/useUserSearch'
import { useNotifications } from '@/context/NotificationContext'
import { addContact } from '@/services/contactsService'

const MIN_QUERY_LENGTH = 3

/**
 * The single add-contact path: search registered users by name or email and
 * save them. Stays open after a save so several people can be added in one go —
 * each saved user drops out of the results once the parent list refreshes.
 * Mount only while open (`{isOpen && <AddContactModal … />}`) so each run
 * starts from a clean query.
 */
export default function AddContactModal({ isOpen, onClose, existingIds, currentUserId, onAdded }) {
  const { notify } = useNotifications()
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState(null)
  const { results, isLoading: isSearching } = useUserSearch(query)

  const addableResults = results.filter(
    (u) => u.user_id !== currentUserId && !existingIds.has(u.user_id),
  )
  const showResults = query.trim().length >= MIN_QUERY_LENGTH

  async function handleAdd(user) {
    setBusyId(user.user_id)
    try {
      await addContact({ contact_user_id: user.user_id })
      await onAdded()
      notify({ type: 'success', message: 'Contact added.', surface: 'toast' })
    } catch (err) {
      notify({ type: 'error', message: err.message, surface: 'toast' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add a contact"
      subtitle="Search registered users by name or email, then save them to your contacts."
      size="lg"
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9 pr-10"
            autoFocus
          />
          {isSearching && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </span>
          )}
        </div>

        {!showResults ? (
          <p className="rounded-panel border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Type at least {MIN_QUERY_LENGTH} characters to search.
          </p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-surface border border-border">
            {isSearching ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>
            ) : addableResults.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">No new users found.</p>
            ) : (
              addableResults.map((u) => (
                <div
                  key={u.user_id}
                  className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0"
                >
                  <UserAvatar user={u} className="h-9 w-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {u.first_name} {u.last_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === u.user_id}
                    onClick={() => handleAdd(u)}
                  >
                    {busyId === u.user_id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="size-4" /> Add
                      </>
                    )}
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  )
}
