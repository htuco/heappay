import logo from '@/assets/logo.png'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import AuthButton from '@/components/auth-ui/AuthButton'
import AuthCloseButton from '@/components/auth-ui/AuthCloseButton'
import AuthPageHeader from '@/components/auth-ui/AuthPageHeader'
import FormBanner from '@/components/ui/FormBanner'
import { verifyRecoveryEmail } from '@/services/authService'
import { getApiErrorMessage } from '@/utils/api'

export default function VerifyRecoveryEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [bannerError, setBannerError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleVerify() {
    if (!token) {
      setBannerError('Verification link is missing a token.')
      return
    }
    setBannerError('')
    setSuccess('')
    setLoading(true)
    try {
      const response = await verifyRecoveryEmail({ token })
      setSuccess(response.message || 'Recovery email verified.')
    } catch (err) {
      setBannerError(getApiErrorMessage(err, 'Could not verify recovery email.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <AuthCloseButton onClick={() => navigate('/login')} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
        <AuthPageHeader
          logoSrc={logo}
          title="Verify recovery email"
          subtitle="Confirm this address for password reset and account alerts."
        />

        <div className="mt-8 space-y-4">
          <FormBanner variant="error" message={bannerError} />
          <FormBanner variant="success" message={success} />

          {!success ? (
            <AuthButton
              type="button"
              onClick={handleVerify}
              disabled={loading || !token}
              loading={loading}
            >
              <MailCheck className="h-4 w-4" />
              Verify recovery email
            </AuthButton>
          ) : (
            <AuthButton type="button" onClick={() => navigate('/settings')}>
              Go to Settings
            </AuthButton>
          )}

          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-card-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
