import { NavLink } from 'react-router-dom'
import { Home, Info, TrendingUp, BarChart3, CreditCard, FileText, Download, Settings, LifeBuoy } from 'lucide-react'

const navLinks = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'About', path: '/about', icon: Info },
]

export default function navbar() {
  return (
    
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
       )
}
