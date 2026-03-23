import { Outlet } from 'react-router-dom'
import { Link } from 'react-router-dom'

export default function Layout() {
  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link to="/" className="text-xl font-bold text-gray-900 hover:text-blue-600 transition">
            Heap
          </Link>
        </div>
      </nav>

      {/* Main content with sidebar */}
      <div className="flex flex-1 gap-6 max-w-7xl mx-auto w-full px-6 py-6">
        {/* Sidebar */}
        <aside className="w-64 bg-white rounded-lg p-6">
          <nav className="space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="block px-4 py-2 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
              >
                {link.name}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 bg-white rounded-lg p-8 border border-gray-200">
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white rounded-lg m-6 mt-0 border border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-sm text-gray-600">
          © 2026 Heap. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
