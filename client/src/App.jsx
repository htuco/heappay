import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import AdminPage from './pages/AdminPage'
import SupportPage from './pages/SupportPage'
import SupportUsersPage from './pages/SupportUsersPage'
import SupportTicketsPage from './pages/SupportTicketsPage'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/Dashboard'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import PaymentPage from './pages/PaymentPage'
import SettingsPage from './pages/SettingsPage'
import WalletPage from './pages/WalletPage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import { getAuthRefreshToken, getAuthToken } from './utils/authStorage'
import { useAuth } from './hooks/useAuth'
import { useAppDispatch } from './store/hooks'
import { clearAuthState } from './store/slices/authSlice'
import { fetchReferenceDataOnce } from './store/slices/referenceDataSlice'

function ProtectedRoute({ children }) {
  const hasAccessToken = Boolean(getAuthToken())
  const hasRefreshToken = Boolean(getAuthRefreshToken())
  if (!hasAccessToken && !hasRefreshToken) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AdminRoute({ children }) {
  const { isHydrated, isAuthenticated, isAdmin } = useAuth()

  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/dashboard" replace />

  return children
}

function StaffRoute({ children }) {
  const { isHydrated, isAuthenticated, isStaff } = useAuth()

  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isStaff) return <Navigate to="/dashboard" replace />

  return children
}

function PublicOnlyRoute({ children }) {
  if (getAuthToken() || getAuthRefreshToken()) {
    return <Navigate to="/dashboard" replace />
  }
  return children
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
      <Route
        path="/"
        element={
          getAuthToken() || getAuthRefreshToken()
            ? <Navigate to="/dashboard" replace />
            : <LandingPage />
        }
      />
      <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
      <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />

      {/* App shell routes */}
      <Route element={<Layout />}>
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="/support" element={<StaffRoute><Navigate to="/support/users" replace /></StaffRoute>} />
        <Route path="/support/users" element={<StaffRoute><SupportUsersPage /></StaffRoute>} />
        <Route path="/support/tickets" element={<StaffRoute><SupportTicketsPage /></StaffRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  )
}
