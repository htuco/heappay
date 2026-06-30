import logo from '@/assets/logo.png'
import { ArrowLeft, Mail } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import AuthButton from '@/components/auth-ui/AuthButton'
import AuthCloseButton from '@/components/auth-ui/AuthCloseButton'
import AuthPageHeader from '@/components/auth-ui/AuthPageHeader'
import AuthTextInput from '@/components/auth-ui/AuthTextInput'
import HCaptchaField from '@/components/auth-ui/HCaptchaField'
import FormBanner from '@/components/ui/FormBanner'
import { requestPasswordReset } from '@/services/authService'
import { getApiErrorMessage } from '@/utils/api'
import { isHCaptchaEnabled } from '@/utils/hcaptcha'

const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Invalid email format'),
})

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [bannerError, setBannerError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [hcaptchaToken, setHcaptchaToken] = useState('')
  const captchaRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setFieldError('')
    setBannerError('')
    setSuccess('')

    const result = forgotPasswordSchema.safeParse({ email })
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message || 'Enter a valid email address.')
      return
    }
    if (isHCaptchaEnabled() && !hcaptchaToken) {
      setBannerError('Please complete the security check and try again.')
      return
    }

    setLoading(true)
    try {
      const response = await requestPasswordReset({
        email: result.data.email,
        hcaptchaToken,
      })
      setSuccess(response.message || 'If an account exists for this email, a reset link has been sent.')
      setHcaptchaToken('')
      captchaRef.current?.resetCaptcha()
    } catch (err) {
      setBannerError(getApiErrorMessage(err, 'Could not request password reset.'))
      setHcaptchaToken('')
      captchaRef.current?.resetCaptcha()
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="relative flex min-h-screen items-center justify-center px-6 py-10 text-foreground">
      <AuthCloseButton />

      <div className="mx-auto w-full max-w-110">
        <div className="space-y-6">
          <AuthPageHeader
            title="Password recovery"
            subtitle="Enter your account email to receive a reset link."
            icon={<img src={logo} alt="Heap logo" className="h-9 w-auto" />}
            iconWrapperClassName="!bg-none !bg-transparent !text-foreground h-14 w-14"
          />

          <form className="space-y-5" onSubmit={handleSubmit}>
            <FormBanner variant="success" message={success} />
            <FormBanner variant="error" message={bannerError} />

            <AuthTextInput
              id="recoveryEmail"
              name="email"
              type="email"
              label="Account email"
              placeholder="E-mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              error={fieldError}
            />

            <HCaptchaField
              captchaRef={captchaRef}
              disabled={loading}
              onVerify={setHcaptchaToken}
              onExpire={() => setHcaptchaToken('')}
              onError={() => {
                setHcaptchaToken('')
                setBannerError('Security check failed to load. Please try again.')
              }}
            />

            <AuthButton type="submit" disabled={loading}>
              <Mail className="mr-2 inline h-5 w-5 align-[-3px]" />
              {loading ? 'Sending...' : 'Send reset link'}
            </AuthButton>
          </form>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mx-auto flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </button>
        </div>
      </div>
    </section>
  )
}
