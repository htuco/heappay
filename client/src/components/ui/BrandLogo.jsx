import logoLight from '@/assets/logo-light.png'
import logoDark from '@/assets/logo-dark.png'

/**
 * Theme-aware HeapPay wordmark.
 *
 * Shows the dark-text logo on light backgrounds and the light-text logo on
 * dark backgrounds, so the wordmark stays legible in both themes.
 */
export default function BrandLogo({ className, alt = 'HeapPay' }) {
  return (
    <>
      <img src={logoLight} alt={alt} className={`${className} dark:hidden`} />
      <img src={logoDark} alt={alt} className={`${className} hidden dark:block`} />
    </>
  )
}
