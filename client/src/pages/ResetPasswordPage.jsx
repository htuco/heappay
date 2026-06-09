import logo from '@/assets/logo.png'
import { ArrowLeft, KeyRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import AuthButton from '@/components/auth-ui/AuthButton'
import AuthCloseButton from '@/components/auth-ui/AuthCloseButton'
import AuthPageHeader from '@/components/auth-ui/AuthPageHeader'
import AuthTextInput from '@/components/auth-ui/AuthTextInput'
import FormBanner from '@/components/ui/FormBanner'
import { changePasswordSchema } from '@/schemas/changePasswordSchema'
import { confirmPasswordReset } from '@/services/authService'
import { getApiErrorMessage } from '@/utils/api'

const INITIAL_FORM = {
  currentPassword: 'reset-token',
  newPassword: '',
  confirmPassword: '',
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const [form, setForm] = useState(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [bannerError, setBannerError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFieldErrors({})
    setBannerError('')
    setSuccess('')

    if (!token) {
      setBannerError('Password reset link is missing a token.')
      return
    }

    const result = changePasswordSchema.safeParse(form)
    if (!result.success) {
      const errors = {}
      result.error.issues.forEach((issue) => {
        if (issue.path[0] && issue.path[0] !== 'currentPassword') {
          errors[issue.path[0]] = issue.message
        }
      })
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const response = await confirmPasswordReset({
        token,
        newPassword: result.data.newPassword,
      })
      setSuccess(response.message || 'Password reset successfully. You can sign in now.')
      setForm(INITIAL_FORM)
    } catch (err) {
      setBannerError(getApiErrorMessage(err, 'Could not reset password.'))
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
            title="Reset password"
            subtitle="Choose a new password for your Heap account."
            icon={<img src={logo} alt="Heap logo" className="h-9 w-auto" />}
            iconWrapperClassName="!bg-none !bg-transparent !text-foreground h-14 w-14"
          />

          <form className="space-y-5" onSubmit={handleSubmit}>
            <FormBanner variant="success" message={success} />
            <FormBanner variant="error" message={bannerError} />

            <AuthTextInput
              id="newPassword"
              name="newPassword"
              type="password"
              label="New password"
              placeholder="Minimum 8 characters"
              value={form.newPassword}
              onChange={handleChange}
              disabled={loading || Boolean(success)}
              error={fieldErrors.newPassword}
            />

            <AuthTextInput
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm new password"
              placeholder="Repeat your new password"
              value={form.confirmPassword}
              onChange={handleChange}
              disabled={loading || Boolean(success)}
              error={fieldErrors.confirmPassword}
            />

            <AuthButton type="submit" disabled={loading || Boolean(success)}>
              <KeyRound className="mr-2 inline h-5 w-5 align-[-3px]" />
              {loading ? 'Resetting...' : 'Reset password'}
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
