import { useMemo, useRef, useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageActionButton, PageActionSlot } from '@/components/ui/PageAction'
import AddContactModal from '@/components/contacts/AddContactModal'
import ContactDetailPanel from '@/components/contacts/ContactDetailPanel'
import ContactFilters from '@/components/contacts/ContactFilters'
import ContactRow from '@/components/contacts/ContactRow'
import QuickSendStrip from '@/components/contacts/QuickSendStrip'
import PaymentWizard from '@/components/payment/PaymentWizard'
import useContacts from '@/hooks/useContacts'
import useContactPayments from '@/hooks/useContactPayments'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/context/NotificationContext'
import { removeContact, updateContact } from '@/services/contactsService'
import { maskCardNumber } from '@/utils/cardMask'
import { CONTACT_VIEWS, CONTACT_VIEW_HEADINGS, filterContacts } from '@/utils/contacts.utils'

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
  const payments = useContactPayments()

  const [search, setSearch] = useState('')
  const [view, setView] = useState(CONTACT_VIEWS.all)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [panelMode, setPanelMode] = useState('view')
  const [busyId, setBusyId] = useState(null)
  const [sendRecipient, setSendRecipient] = useState(null)
  const panelRef = useRef(null)

  const existingIds = useMemo(() => new Set(contacts.map((c) => c.user_id)), [contacts])

  const visibleContacts = useMemo(
    () => filterContacts(contacts, { search, view }, payments.byUserId),
    [contacts, search, view, payments.byUserId],
  )

  const pinned = useMemo(() => contacts.filter((c) => c.is_favorite), [contacts])
  const unpinned = useMemo(() => contacts.filter((c) => !c.is_favorite), [contacts])

  const selected = contacts.find((c) => c.contact_id === selectedId) ?? null

  function openPanel(contact, mode = 'view') {
    setSelectedId(contact.contact_id)
    setPanelMode(mode)
    if (mode !== 'view') {
      // On phones the panel sits below the list, so bring it into view when a
      // row's overflow menu opens it. A no-op when it's already on screen.
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  function startSend(contact) {
    setSendRecipient(recipientFromContact(contact))
  }

  function closeWizard() {
    setSendRecipient(null)
  }

  async function handleTogglePin(contact) {
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

  async function handleSaveAlias(contact, alias) {
    setBusyId(contact.contact_id)
    try {
      await updateContact(contact.contact_id, { alias })
      await refresh()
      notify({ type: 'success', message: 'Contact updated.', surface: 'toast' })
      return true
    } catch (err) {
      notify({ type: 'error', message: err.message, surface: 'toast' })
      return false
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(contact) {
    setBusyId(contact.contact_id)
    try {
      await removeContact(contact.contact_id)
      setSelectedId(null)
      await refresh()
      notify({ type: 'success', message: 'Contact removed.', surface: 'toast' })
    } catch (err) {
      notify({ type: 'error', message: err.message, surface: 'toast' })
    } finally {
      setBusyId(null)
    }
  }

  const hasContacts = contacts.length > 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageActionSlot>
        <PageActionButton
          icon={UserPlus}
          label="Add contact"
          data-tour="contacts-add"
          onClick={() => setAddOpen(true)}
        />
      </PageActionSlot>

      {hasContacts && (
        <QuickSendStrip
          pinned={pinned}
          unpinned={unpinned}
          payments={payments.byUserId}
          onSend={startSend}
          onPin={handleTogglePin}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Card className="overflow-hidden p-0">
          <ContactFilters
            search={search}
            onSearchChange={setSearch}
            view={view}
            onViewChange={setView}
            disabled={!hasContacts && !isLoading}
          />

          <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-3 py-2 sm:px-4">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {CONTACT_VIEW_HEADINGS[view]}
            </h2>
            <p className="text-xs text-muted-foreground">
              {visibleContacts.length} of {contacts.length}
            </p>
          </div>

          {isLoading ? (
            <p className="flex items-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading contacts…
            </p>
          ) : error ? (
            <p className="px-4 py-8 text-sm text-destructive">{error}</p>
          ) : visibleContacts.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {!hasContacts
                  ? 'No contacts yet. Add someone to send money in two clicks.'
                  : 'No contacts match this view.'}
              </p>
              {!hasContacts && (
                <Button type="button" size="sm" className="mt-3" onClick={() => setAddOpen(true)}>
                  <UserPlus className="size-4" /> Add contact
                </Button>
              )}
            </div>
          ) : (
            <div>
              {visibleContacts.map((contact) => (
                <ContactRow
                  key={contact.contact_id}
                  contact={contact}
                  payment={payments.byUserId[contact.user_id]}
                  isSelected={contact.contact_id === selectedId}
                  isBusy={busyId === contact.contact_id}
                  onSelect={openPanel}
                  onSend={startSend}
                  onTogglePin={handleTogglePin}
                  onEdit={(c) => openPanel(c, 'edit')}
                  onRemove={(c) => openPanel(c, 'remove')}
                />
              ))}
            </div>
          )}
        </Card>

        <div ref={panelRef} className="lg:sticky lg:top-4">
          <ContactDetailPanel
            key={`${selected?.contact_id ?? 'none'}-${panelMode}`}
            contact={selected}
            payment={selected ? payments.byUserId[selected.user_id] : null}
            year={payments.year}
            isBusy={busyId === selected?.contact_id}
            isLoadingPayments={payments.isLoading}
            mode={panelMode}
            onSend={startSend}
            onTogglePin={handleTogglePin}
            onSaveAlias={handleSaveAlias}
            onRemove={handleRemove}
          />
        </div>
      </div>

      <PaymentWizard
        isOpen={sendRecipient !== null}
        initialRecipient={sendRecipient}
        onClose={closeWizard}
        onSuccess={closeWizard}
      />

      {/* Mounted only while open so each run starts from a clean search. */}
      {addOpen && (
        <AddContactModal
          isOpen
          onClose={() => setAddOpen(false)}
          existingIds={existingIds}
          currentUserId={currentUserId}
          onAdded={refresh}
        />
      )}
    </div>
  )
}
