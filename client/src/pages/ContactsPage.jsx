import { useMemo, useRef, useState } from 'react'
import {
  Check,
  CreditCard,
  Loader2,
  Pencil,
  Search,
  Send,
  Star,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import UserAvatar from '@/components/ui/UserAvatar'
import PaymentWizard from '@/components/payment/PaymentWizard'
import useContacts from '@/hooks/useContacts'
import useUserSearch from '@/hooks/useUserSearch'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/context/NotificationContext'
import { addContact, removeContact, updateContact } from '@/services/contactsService'
import { maskCardNumber } from '@/utils/cardMask'

// Build the recipient shape PaymentWizard expects from a saved contact.
function recipientFromContact(contact) {
  const card = contact.default_card
  return {
    user_id: contact.user_id,
    owner_name: `${contact.first_name} ${contact.last_name}`.trim(),
    owner_email: contact.email,
    avatar_url: contact.avatar_url,
    masked_card_number: maskCardNumber(card.last_four, { brand: card.vendor }),
    last_four: card.last_four,
    brand: card.vendor,
    card_id: card.card_id,
  }
}

export default function ContactsPage() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? user?.user_id
  const { notify } = useNotifications()
  const { contacts, isLoading, error, refresh } = useContacts()

  const [addQuery, setAddQuery] = useState('')
  const { results, isLoading: isSearching } = useUserSearch(addQuery)

  const [filter, setFilter] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [aliasDraft, setAliasDraft] = useState('')
  const [confirmingId, setConfirmingId] = useState(null)
  const [sendRecipient, setSendRecipient] = useState(null)
  const [sendMoneyOpen, setSendMoneyOpen] = useState(false)
  const addInputRef = useRef(null)

  function focusAddContact() {
    addInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    addInputRef.current?.focus()
  }

  function closeWizard() {
    setSendRecipient(null)
    setSendMoneyOpen(false)
  }

  const existingIds = useMemo(
    () => new Set(contacts.map((c) => c.user_id)),
    [contacts],
  )

  const addableResults = results.filter(
    (u) => u.user_id !== currentUserId && !existingIds.has(u.user_id),
  )

  const filteredContacts = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return contacts
    return contacts.filter((c) =>
      [c.display_name, c.email, c.alias].some((v) => v?.toLowerCase().includes(q)),
    )
  }, [contacts, filter])

  async function handleAdd(u) {
    setBusyId(u.user_id)
    try {
      await addContact({ contact_user_id: u.user_id })
      setAddQuery('')
      await refresh()
      notify({ type: 'success', message: 'Contact added.', surface: 'toast' })
    } catch (err) {
      notify({ type: 'error', message: err.message, surface: 'toast' })
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleFavorite(contact) {
    setBusyId(contact.contact_id)
    try {
      await updateContact(contact.contact_id, { is_favorite: !contact.is_favorite })
      await refresh()
    } catch (err) {
      notify({ type: 'error', message: err.message, surface: 'toast' })
    } finally {
      setBusyId(null)
    }
  }

  function startEdit(contact) {
    setEditingId(contact.contact_id)
    setAliasDraft(contact.alias ?? '')
  }

  async function saveAlias(contact) {
    setBusyId(contact.contact_id)
    try {
      await updateContact(contact.contact_id, { alias: aliasDraft.trim() })
      setEditingId(null)
      await refresh()
      notify({ type: 'success', message: 'Contact updated.', surface: 'toast' })
    } catch (err) {
      notify({ type: 'error', message: err.message, surface: 'toast' })
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(contact) {
    setBusyId(contact.contact_id)
    try {
      await removeContact(contact.contact_id)
      setConfirmingId(null)
      await refresh()
      notify({ type: 'success', message: 'Contact removed.', surface: 'toast' })
    } catch (err) {
      notify({ type: 'error', message: err.message, surface: 'toast' })
    } finally {
      setBusyId(null)
    }
  }

  const showSearchResults = addQuery.trim().length >= 3

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Save people you pay often for quick access when sending money.
          </p>
        </div>
        <div className="shrink-0 rounded-surface border border-border bg-muted/40 px-4 py-3 text-right">
          <p className="text-xs font-medium text-muted-foreground">Saved contacts</p>
          <p className="text-lg font-bold tracking-tight text-foreground">
            {contacts.length} active
          </p>
        </div>
      </header>

      {/* Add a contact */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus className="size-4 text-primary" aria-hidden />
          <h2 className="text-base font-bold tracking-tight text-foreground">Add a contact</h2>
        </div>
        <div className="relative">
          <Input
            ref={addInputRef}
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="pr-10"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            {isSearching ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <Search className="size-4 text-muted-foreground" />
            )}
          </span>
        </div>

        {showSearchResults && (
          <div className="max-h-64 overflow-y-auto rounded-surface border border-border">
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
      </Card>

      {/* Contact list */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold tracking-tight text-foreground">
            Your contacts{contacts.length > 0 ? ` (${contacts.length})` : ''}
          </h2>
          {contacts.length > 0 && (
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter…"
              className="max-w-44"
            />
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading contacts…
          </div>
        ) : error ? (
          <p className="py-6 text-sm text-destructive">{error}</p>
        ) : filteredContacts.length === 0 ? (
          <p className="rounded-panel border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            {contacts.length === 0
              ? 'No contacts yet. Add someone above to get started.'
              : 'No contacts match your filter.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredContacts.map((contact) => {
              const isBusy = busyId === contact.contact_id
              const isEditing = editingId === contact.contact_id
              const isConfirming = confirmingId === contact.contact_id
              return (
                <div
                  key={contact.contact_id}
                  className="flex items-center gap-3 rounded-panel border border-border bg-muted/30 px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(contact)}
                    disabled={isBusy}
                    aria-label={contact.is_favorite ? 'Unfavorite' : 'Favorite'}
                    className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    <Star
                      className={`size-4 ${contact.is_favorite ? 'fill-primary text-primary' : ''}`}
                    />
                  </button>

                  <UserAvatar user={contact} className="h-9 w-9 shrink-0 text-xs" />

                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={aliasDraft}
                          onChange={(e) => setAliasDraft(e.target.value)}
                          placeholder="Alias (optional)"
                          className="h-9"
                          autoFocus
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => saveAlias(contact)}
                          aria-label="Save alias"
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="truncate text-sm font-semibold text-foreground">
                          {contact.display_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                      </>
                    )}
                  </div>

                  {!isEditing && (
                    <>
                      {contact.default_card && (
                        <span className="hidden shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 font-mono text-xs text-muted-foreground sm:flex">
                          <CreditCard className="size-3" />
                          {maskCardNumber(contact.default_card.last_four, {
                            brand: contact.default_card.vendor,
                          })}
                        </span>
                      )}

                      {isConfirming ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={isBusy}
                            onClick={() => handleDelete(contact)}
                          >
                            {isBusy ? <Loader2 className="size-4 animate-spin" /> : 'Remove'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1">
                          {contact.default_card && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setSendRecipient(recipientFromContact(contact))}
                            >
                              <Send className="size-4" /> Send
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(contact)}
                            aria-label="Edit alias"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => setConfirmingId(contact.contact_id)}
                            aria-label="Remove contact"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Quick actions + tip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="space-y-3 sm:col-span-2">
          <h2 className="text-base font-bold tracking-tight text-foreground">Quick actions</h2>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={focusAddContact}>
              <UserPlus className="size-4" /> New contact
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSendMoneyOpen(true)}
            >
              <Send className="size-4" /> Send money
            </Button>
          </div>
        </Card>

        <Card className="space-y-1 bg-primary/5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Tip</p>
          <p className="text-sm font-semibold leading-snug text-foreground">
            Keep frequent contacts starred for faster payments.
          </p>
        </Card>
      </div>

      <PaymentWizard
        isOpen={sendRecipient !== null || sendMoneyOpen}
        initialRecipient={sendRecipient}
        onClose={closeWizard}
        onSuccess={closeWizard}
      />
    </div>
  )
}
