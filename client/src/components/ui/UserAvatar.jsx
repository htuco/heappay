import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

const STOCK_PLACEHOLDER_URL =
  'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop&crop=faces'

function pickAvatarUrl(user) {
  if (!user) return null
  return user.avatar_url ?? user.avatarUrl ?? null
}

function getInitials(user) {
  const first = user?.first_name?.[0] ?? ''
  const last = user?.last_name?.[0] ?? ''
  return (first + last).toUpperCase() || '?'
}

export default function UserAvatar({
  user,
  className = '',
  textClassName = '',
  src,
  /** When there is no custom image URL, load a stock portrait instead of showing initials. */
  useStockPlaceholder = true,
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const [imageReady, setImageReady] = useState(false)
  const customUrl = src ?? pickAvatarUrl(user)
  const imageSrc =
    customUrl ?? (useStockPlaceholder ? STOCK_PLACEHOLDER_URL : null)

  useEffect(() => {
    setImageFailed(false)
    setImageReady(false)
  }, [imageSrc])

  const initials = getInitials(user)
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
            alt={initials}
            referrerPolicy="no-referrer"
            decoding="async"
            className={cn(
              'block h-full w-full min-h-0 min-w-0 object-cover transition-opacity duration-200 ease-out',
              imageReady ? 'opacity-100' : 'opacity-0',
            )}
            onLoad={() => setImageReady(true)}
            onError={() => {
              setImageReady(false)
              setImageFailed(true)
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
