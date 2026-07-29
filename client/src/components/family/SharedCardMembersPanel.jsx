import { useEffect, useState } from 'react'
import { Loader2, Sliders, UserPlus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import UserAvatar from '@/components/ui/UserAvatar'
import { addCardMember, listCardMembers, removeCardMember } from '@/services/familyService'

/**
 * Guardian-facing membership manager for a shared card: who (among the
 * guardian's accepted dependents) can spend from it, plus a shortcut into
 * each member's own per-card spending limits.
 */
export default function SharedCardMembersPanel({ cardId, dependents, onOpenMemberLimits }) {
  const [members, setMembers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [addSelection, setAddSelection] = useState('')
  const [busyDependentId, setBusyDependentId] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    listCardMembers(cardId)
      .then(setMembers)
      .catch((err) => setError(err?.message || 'Could not load members.'))
      .finally(() => setIsLoading(false))
  }, [cardId])

  const memberIds = new Set(members.map((m) => m.dependent_user_id))
  const addableDependents = (dependents ?? []).filter(
    (link) => !memberIds.has(link.dependent.user_id),
  )

  async function handleAdd() {
    if (!addSelection) return
    const dependentUserId = Number(addSelection)
    setBusyDependentId(dependentUserId)
    setError('')
    try {
      const member = await addCardMember(cardId, dependentUserId)
      setMembers((prev) => [...prev, member])
      setAddSelection('')
    } catch (err) {
      setError(err?.message || 'Could not add this member.')
    } finally {
      setBusyDependentId(null)
    }
  }

  async function handleRemove(member) {
    setBusyDependentId(member.dependent_user_id)
    try {
      await removeCardMember(cardId, member.dependent_user_id)
      setMembers((prev) => prev.filter((m) => m.dependent_user_id !== member.dependent_user_id))
    } catch (err) {
      setError(err?.message || 'Could not remove this member.')
    } finally {
      setBusyDependentId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading members…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {addableDependents.length > 0 ? (
        <div className="flex items-center gap-2">
          <Select
            value={addSelection}
            onChange={(e) => setAddSelection(e.target.value)}
            placeholder="Add a dependent…"
            options={addableDependents.map((link) => ({
              value: String(link.dependent.user_id),
              label: `${link.dependent.first_name} ${link.dependent.last_name}`,
            }))}
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!addSelection || busyDependentId === Number(addSelection)}
          >
            <UserPlus className="mr-1.5 size-3.5" />
            Add
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {members.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          No members yet. Add a dependent above to let them spend from this card.
        </p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.family_card_member_id}
              className="flex items-center justify-between gap-3 rounded-card border border-border px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar user={member} className="h-9 w-9 text-xs" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-card-foreground">
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => onOpenMemberLimits(member)}>
                  <Sliders className="mr-1.5 size-3.5" />
                  Their limits
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  disabled={busyDependentId === member.dependent_user_id}
                  onClick={() => handleRemove(member)}
                >
                  {busyDependentId === member.dependent_user_id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
