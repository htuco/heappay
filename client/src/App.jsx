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
import { getAuthRefreshToken, getAuthToken } from './utils/authStorage'
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
      <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
      <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />

      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  )
}