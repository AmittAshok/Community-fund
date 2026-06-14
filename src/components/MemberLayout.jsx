import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { IndianRupee, LogOut } from 'lucide-react'

export default function MemberLayout() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const handleSignOut = async () => { await signOut(); navigate('/login') }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IndianRupee className="w-6 h-6 text-indigo-300" />
          <div>
            <p className="font-bold text-sm">Community Fund</p>
            <p className="text-indigo-300 text-xs">Member Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium">{profile?.full_name}</p>
            <p className="text-indigo-300 text-xs">{user?.email}</p>
          </div>
          <button onClick={handleSignOut}
            className="flex items-center gap-1 text-indigo-200 hover:text-white text-sm">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
