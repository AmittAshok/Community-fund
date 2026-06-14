import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IndianRupee, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { toast.error(error.message); setLoading(false); return }

    // Check profile role and status
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', data.user.id).single()

    if (profile?.status === 'pending') {
      await supabase.auth.signOut()
      toast.error('Your account is pending admin approval')
      setLoading(false); return
    }
    if (profile?.status === 'rejected') {
      await supabase.auth.signOut()
      toast.error('Your account has been rejected. Contact admin.')
      setLoading(false); return
    }

    toast.success('Welcome back!')
    if (profile?.role === 'admin') navigate('/')
    else navigate('/member')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-100 p-3 rounded-full mb-3">
            <IndianRupee className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Community Fund</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="your@email.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500 mb-3">New member of the community fund?</p>
          <Link to="/register"
            className="flex items-center justify-center gap-2 w-full border-2 border-indigo-200 text-indigo-600 font-medium py-2.5 rounded-lg hover:bg-indigo-50 transition-colors">
            <UserPlus className="w-4 h-4" /> Register as Member
          </Link>
        </div>
      </div>
    </div>
  )
}
