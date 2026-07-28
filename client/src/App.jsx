import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import AdminPage from './pages/AdminPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminTransactionsPage from './pages/AdminTransactionsPage'
import AdminRequestsPage from './pages/AdminRequestsPage'
import AdminAuditLogPage from './pages/AdminAuditLogPage'
import SupportPage from './pages/SupportPage'
import SupportUsersPage from './pages/SupportUsersPage'
import SupportTicketsPage from './pages/SupportTicketsPage'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/Dashboard'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import PaymentPage from './pages/PaymentPage'
import RecurringPaymentsPage from './pages/RecurringPaymentsPage'
import ConverterPage from './pages/ConverterPage'
import ContactsPage from './pages/ContactsPage'
import FamilyPage from './pages/FamilyPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyRecoveryEmailPage from './pages/VerifyRecoveryEmailPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import SettingsPage from './pages/SettingsPage'
import WalletPage from './pages/WalletPage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import AccountSuspendedPage from './pages/AccountSuspendedPage'
import OnboardingSetPasswordPage from './pages/OnboardingSetPasswordPage'
import NotFoundPage from './pages/NotFoundPage'
import RouteLoadingSpinner from './components/routing/RouteLoadingSpinner'
import { getAuthRefreshToken, getAuthToken } from './utils/authStorage'
import { useAuth } from './hooks/useAuth'
import { useUserStatusGuard } from './hooks/useUserStatusGuard'
import { useAppDispatch } from './store/hooks'
import { clearAuthState } from './store/slices/authSlice'
import { fetchReferenceDataOnce } from './store/slices/referenceDataSlice'
import { getStatusHomePath } from './utils/resolveUserAccountStatus'

function hasAuthTokens() {
  return Boolean(getAuthToken() || getAuthRefreshToken())
}

function StatusGatedRoute({ children }) {
  const { isHydrated, isAuthenticated } = useAuth()
  const { status, isLoading } = useUserStatusGuard()

  if (!hasAuthTokens()) {
    return <Navigate to="/login" replace />
  }

  if (isLoading) {
    return <RouteLoadingSpinner />
  }

  if (!isHydrated || !isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (status === 'suspended') {
    return <Navigate to="/account/suspended" replace />
  }

  if (status === 'invited') {
    return <Navigate to="/onboarding/set-password" replace />
  }

  if (status !== 'active') {
    return <Navigate to="/login" replace />
  }

  return children
}

function ProtectedRoute({ children }) {
  return <StatusGatedRoute>{children}</StatusGatedRoute>
}

// The transactions page used to live at /payments. Redirect the old slug and
// carry the query string over, so notification deep-links persisted in
// localStorage before the rename (?tx=<id>) still open the detail panel.
function LegacyPaymentsRedirect() {
  const { search, hash } = useLocation()

  return <Navigate to={`/transactions${search}${hash}`} replace />
}

function AdminRoute({ children }) {
  const { isAdmin } = useAuth()

  return (
    <StatusGatedRoute>
      {!isAdmin ? <Navigate to="/dashboard" replace /> : children}
    </StatusGatedRoute>
  )
}

function StaffRoute({ children }) {
  const { isStaff } = useAuth()

  return (
    <StatusGatedRoute>
      {!isStaff ? <Navigate to="/dashboard" replace /> : children}
    </StatusGatedRoute>
  )
}

function AccountSuspendedRoute({ children }) {
  const { isHydrated, isAuthenticated } = useAuth()
  const { status, isLoading } = useUserStatusGuard()

  if (!hasAuthTokens()) {
    return <Navigate to="/login" replace />
  }

  if (isLoading) {
    return <RouteLoadingSpinner />
  }

  if (!isHydrated || !isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (status === 'active') {
    return <Navigate to="/dashboard" replace />
  }

  if (status === 'invited') {
    return <Navigate to="/onboarding/set-password" replace />
  }

  if (status !== 'suspended') {
    return <Navigate to="/login" replace />
  }

  return children
}

function OnboardingRoute({ children }) {
  const { isHydrated, isAuthenticated } = useAuth()
  const { status, isLoading } = useUserStatusGuard()

  if (!hasAuthTokens()) {
    return <Navigate to="/login" replace />
  }

  if (isLoading) {
    return <RouteLoadingSpinner />
  }

  if (!isHydrated || !isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (status === 'active') {
    return <Navigate to="/dashboard" replace />
  }

  if (status === 'suspended') {
    return <Navigate to="/account/suspended" replace />
  }

  if (status !== 'invited') {
    return <Navigate to="/login" replace />
  }

  return children
}

function PublicOnlyRoute({ children }) {
  const { isHydrated, isAuthenticated } = useAuth()
  const { status, isLoading } = useUserStatusGuard()

  if (!hasAuthTokens()) {
    return children
  }

  if (isLoading) {
    return <RouteLoadingSpinner />
  }

  if (isHydrated && isAuthenticated) {
    return <Navigate to={getStatusHomePath(status)} replace />
  }

  return children
}

function AuthenticatedLandingRedirect() {
  const { isHydrated, isAuthenticated } = useAuth()
  const { status, isLoading } = useUserStatusGuard()

  if (!hasAuthTokens()) {
    return <LandingPage />
  }

  if (isLoading) {
    return <RouteLoadingSpinner />
  }

  if (isHydrated && isAuthenticated) {
    return <Navigate to={getStatusHomePath(status)} replace />
  }

  return <LandingPage />
}

export default function App() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(fetchReferenceDataOnce())
  }, [dispatch])

  useEffect(() => {
    const onUnauthorized = () => {
      dispatch(clearAuthState())
    }
    window.addEventListener('heap:unauthorized', onUnauthorized)
    return () => window.removeEventListener('heap:unauthorized', onUnauthorized)
  }, [dispatch])

  return (
    <Routes>
      {/* Standalone full-screen pages — no app shell */}
      <Route path="/" element={<AuthenticatedLandingRedirect />} />
      <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
      <Route path="/reset-password" element={<PublicOnlyRoute><ResetPasswordPage /></PublicOnlyRoute>} />
      <Route path="/verify-recovery-email" element={<PublicOnlyRoute><VerifyRecoveryEmailPage /></PublicOnlyRoute>} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route
        path="/account/suspended"
        element={
          <AccountSuspendedRoute>
            <AccountSuspendedPage />
          </AccountSuspendedRoute>
        }
      />
      <Route
        path="/onboarding/set-password"
        element={
          <OnboardingRoute>
            <OnboardingSetPasswordPage />
          </OnboardingRoute>
        }
      />

      {/* App shell routes */}
      <Route element={<Layout />}>
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="/admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
        <Route path="/admin/transactions" element={<AdminRoute><AdminTransactionsPage /></AdminRoute>} />
        <Route path="/admin/requests" element={<AdminRoute><AdminRequestsPage /></AdminRoute>} />
        <Route path="/admin/audit-log" element={<AdminRoute><AdminAuditLogPage /></AdminRoute>} />
        <Route path="/support" element={<StaffRoute><Navigate to="/support/users" replace /></StaffRoute>} />
        <Route path="/support/users" element={<StaffRoute><SupportUsersPage /></StaffRoute>} />
        <Route path="/support/tickets" element={<StaffRoute><SupportTicketsPage /></StaffRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
        {/* Legacy slug — keeps old bookmarks and notifications stored before the
            rename working. Preserves ?tx=<id> so deep-links still open the panel. */}
        <Route path="/payments" element={<LegacyPaymentsRedirect />} />
        <Route path="/recurring" element={<ProtectedRoute><RecurringPaymentsPage /></ProtectedRoute>} />
        <Route path="/converter" element={<ProtectedRoute><ConverterPage /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute><ContactsPage /></ProtectedRoute>} />
        <Route path="/family" element={<ProtectedRoute><FamilyPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      </Route>

      {/* Catch-all — any unmatched path renders a NotFound page instead of a blank screen */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
