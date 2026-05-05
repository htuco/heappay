import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import AdminPage from './pages/AdminPage'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/Dashboard'
import SettingsPage from './pages/SettingsPage'
import WalletPage from './pages/WalletPage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import { getAuthRefreshToken, getAuthToken, getAuthUser } from './utils/authStorage'
import { useAppDispatch } from './store/hooks'
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
  const hasAccessToken = Boolean(getAuthToken())
  const hasRefreshToken = Boolean(getAuthRefreshToken())
  if (!hasAccessToken && !hasRefreshToken) {
    return <Navigate to="/login" replace />
  }
  const user = getAuthUser()
  if (!user || user.role_name !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }
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

      {/* App shell routes */}
      <Route element={<Layout />}>
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  )
}