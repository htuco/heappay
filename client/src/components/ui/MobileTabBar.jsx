import { NavLink } from 'react-router-dom'
import { useAppSelector } from '@/store/hooks'
import { selectAuthUser } from '@/store/slices/authSlice'
import { MAIN_NAV_LINKS, SETTINGS_NAV_LINK, getRoleNavLinks } from './navLinks'

function TabBarItem({ item }) {
  const Icon = item.icon

  return (
    <li className="min-w-0 flex-1">
      <NavLink
        to={item.path}
        end
        className={({ isActive }) =>
          `relative flex min-h-12 flex-col items-center justify-center gap-1 px-1 pb-1 pt-2 touch-manipulation ${
            isActive ? 'text-primary' : 'text-muted-foreground'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={`absolute inset-x-3 top-0 h-0.5 rounded-pill bg-primary transition-opacity ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.25 : 2} />
            <span
              className={`max-w-full truncate text-[10px] leading-none ${
                isActive ? 'font-semibold' : 'font-medium'
              }`}
            >
              {item.name}
            </span>
          </>
        )}
      </NavLink>
    </li>
  )
}

export default function MobileTabBar() {
  const user = useAppSelector(selectAuthUser)

  if (!user) return null

  const tabs = [...MAIN_NAV_LINKS, ...getRoleNavLinks(user.role_name), SETTINGS_NAV_LINK]

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-md pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] md:hidden"
    >
      <ul className="flex items-stretch">
        {tabs.map((item) => (
          <TabBarItem key={item.path} item={item} />
        ))}
      </ul>
    </nav>
  )
}
