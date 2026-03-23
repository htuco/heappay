import { Outlet } from 'react-router-dom'
import { Link } from 'react-router-dom'

export default function Layout() {
  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
  ]

  return (
    
      <div className="w-screen h-screen bg-gradient-to-tr from-indigo-600 via-purple-400 to-cyan-300 flex flex-col gap-5 p-5">
        {/* zasad placeholder navbar */}
        <nav className="bg-white rounded-xl px-7 py-5">
          <Link to="/" className="text-2xl font-bold text-gray-900 hover:text-indigo-600 transition">
            Heap - Header Placeholder
          </Link>
        </nav>

        {/* glavni sadrzaj sa sidebarom */}
        <div className="flex flex-1 gap-5 overflow-hidden">
          {/* sidebar */}
          <aside className="w-64 bg-white rounded-xl px-5 py-7">
            <nav className="space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="block px-4 py-3 text-gray-700 hover:text-indigo-600  rounded-lg transition font-medium"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </aside>
        
          {/* glavni sadrzaj i footer */}
          <div className="flex-1 flex flex-col gap-5 overflow-hidden">
            {/* glavni sadrzaj */}
            <main className="flex-1 bg-white/80 backdrop-blur-md rounded-xl p-7 overflow-auto">
              <Outlet />
            </main>

            {/* footer */}
            <footer className="bg-white rounded-xl px-7 py-5 text-center text-sm text-gray-600">
              © 2026 Heap. All rights reserved. Footer placeholder.
            </footer>
          </div>
        </div>
        </div>
      
  )
}
