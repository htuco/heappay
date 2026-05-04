import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import AdminPage from './pages/AdminPage'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/Dashboard'
import SettingsPage from './pages/SettingsPage'
import WalletPage from './pages/WalletPage'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'

export default function App() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Everything else (including `/`) uses Layout */}
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}