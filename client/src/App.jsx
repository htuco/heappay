import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import SettingsPage from './pages/SettingsPage'
import CardViewDemoPage from './pages/CardViewDemoPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/card-view-demo" element={<CardViewDemoPage />} />
      </Route>
    </Routes>
  )
}
