import { useState } from 'react'
import { Check, Loader2, UserPlus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import UserAvatar from '@/components/ui/UserAvatar'
import { useAuth } from '@/hooks/useAuth'
import useFamilyDependents from '@/hooks/useFamilyDependents'
import { useNotifications } from '@/context/NotificationContext'
import DependentCard from '@/components/family/DependentCard'
import DependentCardsPanel from '@/components/family/DependentCardsPanel'
import InviteDependentModal from '@/components/family/InviteDependentModal'
import SpendingLimitRuleList from '@/components/family/SpendingLimitRuleList'
import { acceptInvite, declineInvite, revokeFamilyLink } from '@/services/familyService'

export default function FamilyPage() {
  const { user } = useAuth()
  const currentUserId = user?.id ?? user?.user_id
  const { notify } = useNotifications()
  const { dependents, incomingInvites, isLoading, error, refresh } = useFamilyDependents()

  const [inviteOpen, setInviteOpen] = useState(false)
  const [busyLinkId, setBusyLinkId] = useState(null)
  const [limitsLink, setLimitsLink] = useState(null)
  const [cardsLink, setCardsLink] = useState(null)

  async function handleAccept(link) {
    setBusyLinkId(link.family_link_id)
    try {
      await acceptInvite(link.family_link_id)
      notify({
        type: 'success',
        message: `You're now linked with ${link.guardian.first_name}.`,
        surface: 'toast',
      })
      refresh()
    } catch (err) {
      notify({
        type: 'error',
        message: err?.message ?? 'Could not accept this invite.',
        surface: 'toast',
      })
    } finally {
      setBusyLinkId(null)
    }
  }

  async function handleDecline(link) {
    setBusyLinkId(link.family_link_id)
    try {
      await declineInvite(link.family_link_id)
      refresh()
    } catch (err) {
      notify({
        type: 'error',
        message: err?.message ?? 'Could not decline this invite.',
        surface: 'toast',
      })
    } finally {
      setBusyLinkId(null)
    }
  }

  async function handleRevoke(link) {
    setBusyLinkId(link.family_link_id)
    try {
      await revokeFamilyLink(link.family_link_id)
      refresh()
    } catch (err) {
      notify({
        type: 'error',
        message: err?.message ?? 'Could not remove this family link.',
        surface: 'toast',
      })
    } finally {
      setBusyLinkId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Link a dependent's account so you can manage it together.
        </p>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-1.5 size-4" />
          Invite dependent
        </Button>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading your family account…
        </div>
      ) : error ? (
        <p className="py-4 text-sm text-destructive">{error}</p>
      ) : (
        <>
          {incomingInvites.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Invites for you</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                {incomingInvites.map((link) => (
                  <div
                    key={link.family_link_id}
                    className="flex items-center justify-between gap-3 rounded-card border border-border px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={link.guardian} className="h-9 w-9 text-xs" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-card-foreground">
                          {link.guardian.first_name} {link.guardian.last_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          wants to be your guardian
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyLinkId === link.family_link_id}
                        onClick={() => handleDecline(link)}
                      >
                        <X className="mr-1 size-3.5" />
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        disabled={busyLinkId === link.family_link_id}
                        onClick={() => handleAccept(link)}
                      >
                        {busyLinkId === link.family_link_id ? (
                          <Loader2 className="mr-1 size-3.5 animate-spin" />
                        ) : (
                          <Check className="mr-1 size-3.5" />
                        )}
                        Accept
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>My dependents</CardTitle>
            </CardHeader>
            {dependents.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No dependents yet. Invite an existing Heap account to get started.
              </p>
            ) : (
              <div className="space-y-2">
                {dependents.map((link) => (
                  <DependentCard
                    key={link.family_link_id}
                    link={link}
                    onOpenLimits={setLimitsLink}
                    onOpenCards={setCardsLink}
                    onRevoke={handleRevoke}
                    busy={busyLinkId === link.family_link_id}
                  />
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      <InviteDependentModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        currentUserId={currentUserId}
        onInvited={refresh}
      />

      <DialogRoot open={Boolean(limitsLink)} onOpenChange={(o) => !o && setLimitsLink(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Spending limits {limitsLink ? `· ${limitsLink.dependent.first_name}` : ''}
            </DialogTitle>
            <DialogDescription>
              Cap how much {limitsLink?.dependent.first_name} can spend, or require your approval.
            </DialogDescription>
          </DialogHeader>
          {limitsLink && <SpendingLimitRuleList dependentUserId={limitsLink.dependent.user_id} />}
        </DialogContent>
      </DialogRoot>

      <DialogRoot open={Boolean(cardsLink)} onOpenChange={(o) => !o && setCardsLink(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cards {cardsLink ? `· ${cardsLink.dependent.first_name}` : ''}</DialogTitle>
            <DialogDescription>Freeze or unfreeze this dependent's cards.</DialogDescription>
          </DialogHeader>
          {cardsLink && <DependentCardsPanel dependentUserId={cardsLink.dependent.user_id} />}
        </DialogContent>
      </DialogRoot>
    </div>
  )
}
