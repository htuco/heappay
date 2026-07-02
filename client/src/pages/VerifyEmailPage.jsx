import logo from '@/assets/logo.png'
import { CheckCircle2, MailCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import AuthButton from '@/components/auth-ui/AuthButton'
import AuthCloseButton from '@/components/auth-ui/AuthCloseButton'
import AuthPageHeader from '@/components/auth-ui/AuthPageHeader'
import FormBanner from '@/components/ui/FormBanner'
import { verifyEmail } from '@/services/authService'
import { getAuthRefreshToken, getAuthToken } from '@/utils/authStorage'
import { getApiErrorMessage } from '@/utils/api'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [status, setStatus] = useState(token ? 'verifying' : 'error')
  const [errorMessage, setErrorMessage] = useState(
    token ? '' : 'Verification link is missing a token.'
  )
  const isLoggedIn = Boolean(getAuthToken() || getAuthRefreshToken())

  useEffect(() => {
    if (!token) return

    let ignore = false
    async function run() {
      try {
        await verifyEmail({ token })
        if (!ignore) setStatus('success')
      } catch (err) {
        if (!ignore) {
          setStatus('error')
          setErrorMessage(getApiErrorMessage(err, 'Verification link is invalid or expired.'))
        }
      }
    }
    run()
    return () => {
      ignore = true
    }
  }, [token])

  return (
    <section className="relative flex min-h-screen items-center justify-center px-6 py-10 text-foreground">
      <AuthCloseButton />

      <div className="mx-auto w-full max-w-110">
        <div className="space-y-6">
          <AuthPageHeader
            title="Verify your email"
            subtitle="Confirming your email address."
            icon={<img src={logo} alt="Heap logo" className="h-9 w-auto" />}
            iconWrapperClassName="!bg-none !bg-transparent !text-foreground h-14 w-14"
          />

          {status === 'verifying' && (
            <p className="text-center text-sm text-muted-foreground">Verifying your email…</p>
          )}

          {status === 'success' && (
            <>
              <FormBanner variant="success" message="Your email has been verified." />
              <AuthButton type="button" onClick={() => navigate(isLoggedIn ? '/dashboard' : '/login')}>
                <CheckCircle2 className="mr-2 inline h-5 w-5 align-[-3px]" />
                {isLoggedIn ? 'Go to dashboard' : 'Go to login'}
              </AuthButton>
            </>
          )}

          {status === 'error' && (
            <>
              <FormBanner variant="error" message={errorMessage} />
              <AuthButton type="button" onClick={() => navigate(isLoggedIn ? '/dashboard' : '/login')}>
                <MailCheck className="mr-2 inline h-5 w-5 align-[-3px]" />
                {isLoggedIn ? 'Back to dashboard' : 'Back to login'}
              </AuthButton>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
