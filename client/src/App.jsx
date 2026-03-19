import { Routes, Route, Link } from 'react-router-dom'
import HomePage from './pages/HomePage'
import AboutPage from './pages/AboutPage'

export default function App() {
  return (
    <div className="min-h-screen">
      <nav className="border-b px-6 py-4 flex gap-4">
        <Link to="/">Home</Link>
        <Link to="/about">About</Link>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </div>
  )
}