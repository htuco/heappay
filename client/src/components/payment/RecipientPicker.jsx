import { CheckCircle2, CreditCard, Loader2, Search, Star } from 'lucide-react'
import { Input } from '@/components/ui/input'
import UserAvatar from '@/components/ui/UserAvatar'
import useUserSearch from '@/hooks/useUserSearch'
import useContacts from '@/hooks/useContacts'
import { maskCardNumber } from '@/utils/cardMask'

export default function RecipientPicker({
  query,
  onQueryChange,
  selectedRecipient,
  onSelect,
  currentUserId,
}) {
  const { results, isLoading, error } = useUserSearch(query)
  const { contacts } = useContacts()
  const visibleResults = results.filter((user) => user.default_card)
  const showResults = query.trim().length >= 3 && !selectedRecipient
  // Saved contacts double as quick picks. Only those with an active card can be
  // paid; a contact row has the same shape a search result does, so handleSelect
  // works on it directly.
  const payableContacts = contacts.filter(
    (c) => c.default_card && c.user_id !== currentUserId,
  )
  const showContacts = !selectedRecipient && query.trim().length < 3 && payableContacts.length > 0

  function handleSelect(user) {
    if (user.user_id === currentUserId) return
    const card = user.default_card
    onSelect({
      user_id: user.user_id,
      owner_name: `${user.first_name} ${user.last_name}`.trim(),
      owner_email: user.email,
      avatar_url: user.avatar_url,
      masked_card_number: maskCardNumber(card.last_four, { brand: card.vendor }),
      last_four: card.last_four,
      brand: card.vendor,
      card_id: card.card_id,
    })
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-card-foreground">Recipient email</p>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="name@example.com"
          inputMode="email"
          className="pr-10"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : selectedRecipient ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
      </div>

      {selectedRecipient ? (
        <div className="flex items-center gap-3 rounded-input border border-success/30 bg-success/8 px-3 py-2.5">
          <UserAvatar
            user={{
              first_name: selectedRecipient.owner_name?.split(' ')[0],
              last_name: selectedRecipient.owner_name?.split(' ').slice(1).join(' '),
              avatar_url: selectedRecipient.avatar_url,
            }}
            className="h-9 w-9 text-xs"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-card-foreground">
              {selectedRecipient.owner_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {selectedRecipient.owner_email} · ****{selectedRecipient.last_four}
            </p>
          </div>
        </div>
      ) : null}

      {showContacts ? (
        <div className="space-y-1">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your contacts
          </p>
          <div className="max-h-56 overflow-y-auto rounded-surface border border-border bg-card shadow-sm">
            {payableContacts.map((contact) => (
              <button
                key={contact.contact_id}
                type="button"
                onClick={() => handleSelect(contact)}
                className="flex min-h-11 w-full items-center gap-3 px-3 py-3 text-left transition-colors touch-manipulation hover:bg-muted/40"
              >
                <UserAvatar user={contact} className="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-semibold text-card-foreground">
                    {contact.is_favorite && (
                      <Star className="size-3 shrink-0 fill-primary text-primary" aria-hidden />
                    )}
                    {contact.display_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                  <CreditCard className="h-3 w-3" />
                  ****{contact.default_card.last_four}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showResults ? (
        <div className="max-h-60 overflow-y-auto rounded-surface border border-border bg-card shadow-sm">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : error ? (
            <p className="px-3 py-3 text-sm text-destructive">{error}</p>
          ) : visibleResults.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No recipients with an active card found.
            </p>
          ) : (
            visibleResults.map((user) => (
              <button
                key={user.user_id}
                type="button"
                onClick={() => handleSelect(user)}
                className="flex min-h-11 w-full items-center gap-3 px-3 py-3 text-left transition-colors touch-manipulation hover:bg-muted/40"
              >
                <UserAvatar user={user} className="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-card-foreground">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                  <CreditCard className="h-3 w-3" />
                  ****{user.default_card.last_four}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
