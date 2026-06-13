import authBgDark from '@/assets/auth-illustration-dark.png'
import authBgLight from '@/assets/auth-illustration-light.png'

export default function AuthMobileBackground({ className = '' }) {
  return (
    <div className={`auth-mobile-background ${className}`} aria-hidden="true">
      <div
        className="auth-mobile-background__image auth-mobile-background__image--light"
        style={{ backgroundImage: `url(${authBgLight})` }}
      />
      <div
        className="auth-mobile-background__image auth-mobile-background__image--dark"
        style={{ backgroundImage: `url(${authBgDark})` }}
      />
    </div>
  )
}
