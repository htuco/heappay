import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '@/assets/logo.png'
import AuthButton from '@/components/auth-ui/AuthButton'
import AuthPageHeader from '@/components/auth-ui/AuthPageHeader'
import AuthTextInput from '@/components/auth-ui/AuthTextInput'
import FormBanner from '@/components/ui/FormBanner'
import { invitationPasswordSchema } from '@/schemas/invitationPasswordSchema'
import { acceptInvitation } from '@/services/authService'
import { getApiErrorMessage } from '@/utils/api'
import { useAuth } from '@/hooks/useAuth'
import { useAppDispatch } from '@/store/hooks'
import { refreshSession } from '@/store/slices/authSlice'

const INITIAL_FORM = { newPassword: '', confirmPassword: '' }

export default function OnboardingSetPasswordPage() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { user } = useAuth()
  const [form, setForm] = useState(INITIAL_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [bannerError, setBannerError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFieldErrors({})
    setBannerError('')

    const result = invitationPasswordSchema.safeParse(form)
    if (!result.success) {
      const errs = {}
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) errs[issue.path[0]] = issue.message
      })
      setFieldErrors(errs)
      return
    }

    setLoading(true)
    try {
      await acceptInvitation({ newPassword: form.newPassword })
      await dispatch(refreshSession()).unwrap()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setBannerError(
        getApiErrorMessage(err, 'Could not complete onboarding. Please try again.'),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10 text-foreground">
      <div className="mx-auto w-full max-w-md space-y-6">
        <AuthPageHeader
          title="Set your password"
          subtitle={
            user?.email
              ? `Complete setup for ${user.email} to start using Heap.`
              : 'Complete your invitation to start using Heap.'
          }
          icon={<img src={logo} alt="Heap logo" className="h-9 w-auto" />}
          iconWrapperClassName="!bg-none !bg-transparent !text-foreground h-14 w-14"
        />

        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormBanner variant="error" message={bannerError} />

          <AuthTextInput
            id="newPassword"
            name="newPassword"
            type="password"
            label="New password"
            placeholder="Minimum 8 characters"
            value={form.newPassword}
            onChange={handleChange}
            disabled={loading}
            error={fieldErrors.newPassword}
          />

          <AuthTextInput
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            label="Confirm password"
            placeholder="Repeat your new password"
            value={form.confirmPassword}
            onChange={handleChange}
            disabled={loading}
            error={fieldErrors.confirmPassword}
          />

          <p className="text-xs text-muted-foreground">
            Password must be between 8 and 255 characters.
          </p>

          <AuthButton type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Activate account'}
          </AuthButton>
        </form>
      </div>
    </div>
  )
}
