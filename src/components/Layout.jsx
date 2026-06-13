import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard, Users, FileText,
  CreditCard, LogOut, Menu, X, IndianRupee
} from 'lucide-react'
import { useState } from 'react'

const nav = [
  { to: '/',         label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/members',  label: 'Members',    icon: Users },
  { to: '/loans',    label: 'Loans',      icon: FileText },
  { to: '/payments', label: 'Payments',   icon: CreditCard },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static z-40 w-64 h-full bg-indigo-900 text-white flex flex-col transition-transform duration-200`}>
        <div className="flex items-center gap-3 p-5 border-b border-indigo-700">
          <IndianRupee className="w-7 h-7 text-indigo-300" />
          <div>
            <p className="font-bold text-sm">Community Fund</p>
            <p className="text-indigo-300 text-xs">Management System</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to==='/'} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors
                ${isActive ? 'bg-indigo-700 text-white' : 'text-indigo-200 hover:bg-indigo-800'}`
              }>
              <Icon className="w-4 h-4" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-indigo-700">
          <p className="text-indigo-300 text-xs mb-2 truncate">{user?.email}</p>
          <button onClick={handleSignOut}
            className="flex items-center gap-2 text-indigo-200 hover:text-white text-sm w-full px-4 py-2 rounded-lg hover:bg-indigo-800 transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b px-4 py-3 flex items-center md:hidden">
          <button onClick={() => setOpen(true)}><Menu className="w-5 h-5" /></button>
          <span className="ml-3 font-semibold text-indigo-900">Community Fund</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
