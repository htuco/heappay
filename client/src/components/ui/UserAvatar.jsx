import { useEffect, useState } from 'react'

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
  const customUrl = src ?? pickAvatarUrl(user)
  const imageSrc =
    customUrl ?? (useStockPlaceholder ? STOCK_PLACEHOLDER_URL : null)

  useEffect(() => {
    setImageFailed(false)
  }, [imageSrc])

  const initials = getInitials(user)

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary to-primary-light font-semibold text-primary-foreground ${className}`}
    >
      {!imageFailed && imageSrc ? (
        <img
          key={imageSrc}
          src={imageSrc}
          alt={initials}
          referrerPolicy="no-referrer"
          decoding="async"
          className="block h-full w-full min-h-0 min-w-0 object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={textClassName} aria-hidden>
          {initials}
        </span>
      )}
    </span>
  )
}
