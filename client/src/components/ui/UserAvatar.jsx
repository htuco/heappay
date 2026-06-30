import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

const STOCK_PLACEHOLDER_URL =
  'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop&crop=faces'

const loadedAvatarSrcs = new Set()
const failedAvatarSrcs = new Set()

function pickAvatarUrl(user) {
  if (!user) return null
  return user.avatar_url ?? user.avatarUrl ?? null
}

function getInitials(user) {
  const first = user?.first_name?.[0] ?? ''
  const last = user?.last_name?.[0] ?? ''
  const primary = (first + last).toUpperCase()
  if (primary) return primary

  const fallback = user?.full_name ?? user?.name ?? user?.cardholder_name ?? user?.email ?? ''
  const words = String(fallback).trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return '?'
}

function getAvatarLabel(user, initials) {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
  return (
    [user?.full_name, user?.name, fullName, user?.cardholder_name, user?.email]
      .find((value) => typeof value === 'string' && value.trim())
      ?.trim() ?? initials
  )
}

export default function UserAvatar({
  user,
  className = '',
  textClassName = '',
  src,
  /** Opt in only when a deliberately generic portrait is preferred over initials. */
  useStockPlaceholder = false,
}) {
  const [failedSrc, setFailedSrc] = useState(null)
  const [readySrc, setReadySrc] = useState(null)
  const customUrl = src ?? pickAvatarUrl(user)
  const imageSrc =
    customUrl ?? (useStockPlaceholder ? STOCK_PLACEHOLDER_URL : null)

  const initials = getInitials(user)
  const label = getAvatarLabel(user, initials)
  const imageFailed = imageSrc != null && (failedSrc === imageSrc || failedAvatarSrcs.has(imageSrc))
  const imageReady = imageSrc != null && (readySrc === imageSrc || loadedAvatarSrcs.has(imageSrc))
  const showImage = Boolean(!imageFailed && imageSrc)

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary to-primary-light font-semibold text-primary-foreground',
        className,
      )}
      aria-busy={showImage && !imageReady}
    >
      {showImage ? (
        <>
          <img
            key={imageSrc}
            src={imageSrc}
            alt={label}
            referrerPolicy="no-referrer"
            decoding="async"
            className={cn(
              'block h-full w-full min-h-0 min-w-0 object-cover transition-opacity duration-200 ease-out',
              imageReady ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={() => {
              loadedAvatarSrcs.add(imageSrc)
              setReadySrc(imageSrc)
            }}
            onError={() => {
              failedAvatarSrcs.add(imageSrc)
              setReadySrc(null)
              setFailedSrc(imageSrc)
            }}
          />
          {!imageReady ? (
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/15 backdrop-blur-[2px]"
              aria-hidden
            >
              <Loader2
                className="size-6 shrink-0 animate-spin text-primary-foreground/90 sm:size-7"
                strokeWidth={2}
              />
            </span>
          ) : null}
        </>
      ) : (
        <span className={textClassName} aria-hidden>
          {initials}
        </span>
      )}
    </span>
  )
}
