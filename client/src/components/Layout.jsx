import { Outlet } from 'react-router-dom'
import { Link } from 'react-router-dom'

export default function Layout() {
  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-300 via-purple-100 to-blue-200 flex items-center justify-center p-6">
      {/* Main container */}
      <div className="w-full max-w-6xl h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Navbar */}
        <nav className="bg-white px-8 py-6 border-b border-gray-100">
          <Link to="/" className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition">
            Heap
          </Link>
        </nav>

        {/* Main content with sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-64 bg-gray-50 border-r border-gray-100 px-6 py-8">
            <nav className="space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="block px-4 py-3 text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition font-medium"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main className="flex-1 bg-white p-8 overflow-auto">
            <Outlet />
          </main>
        </div>

        {/* Footer */}
        <footer className="bg-gray-50 border-t border-gray-100 px-8 py-6 text-center text-sm text-gray-600">
          © 2026 Heap. All rights reserved.
        </footer>
      </div>
    </div>
  )
}
