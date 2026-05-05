import { useState } from 'react'

const PLACEHOLDER_AVATAR_URL =
  'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=200&fit=crop&crop=faces'

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
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const imageSrc = src ?? user?.avatar_url ?? PLACEHOLDER_AVATAR_URL
  const initials = getInitials(user)

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary to-sky-500 font-semibold text-primary-foreground ${className}`}
    >
      {!imageFailed && imageSrc ? (
        <img
          src={imageSrc}
          alt={initials}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={textClassName}>{initials}</span>
      )}
    </span>
  )
}
