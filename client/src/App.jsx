import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'
import RegisterPage from './pages/RegisterPage'

export default function App() {
  return (
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
      </Route>
    </Routes>
  )
}