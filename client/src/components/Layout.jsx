import { Outlet, NavLink, Link } from 'react-router-dom'
import { Home, Info, TrendingUp, BarChart3, CreditCard, FileText, Download, Settings, LifeBuoy } from 'lucide-react'

export default function Layout() {
  const navLinks = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'About', path: '/about', icon: Info },
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
          <aside className="w-64 bg-white rounded-xl px-5 py-7 border border-gray-200 shadow-sm">
            <nav className="flex flex-col gap-1">
              {navLinks.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all pb-5 ${
                        isActive
                          ? 'bg-indigo-100 text-indigo-700 border-l-4 border-indigo-500 font-semibold'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`
                    }
                    
                  >
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </NavLink>
                )
              })}
            </nav>
          </aside>
        
          {/* glavni sadrzaj i footer */}
          <div className="flex-1 flex flex-col gap-5 overflow-hidden">
            {/* glavni sadrzaj */}
            <main className="flex-1 bg-white/80 backdrop-blur-md rounded-xl p-7 overflow-auto ">
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
