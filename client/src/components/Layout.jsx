import { Outlet } from 'react-router-dom'
import { Link } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* placeholder navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold text-gray-900 hover:text-blue-600 transition">
              Heap
            </Link>
            <div className="flex gap-6">
              <Link
                to="/"
                className="text-gray-700 hover:text-blue-600 font-medium transition"
              >
                Home
              </Link>
              <Link
                to="/about"
                className="text-gray-700 hover:text-blue-600 font-medium transition"
              >
                About
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* filer page */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <Outlet />
      </main>

      {/* footer (for now) */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-sm text-gray-600">
          © 2026 Heap. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
