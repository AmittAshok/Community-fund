import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IndianRupee, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      let email, pwd

      if (isAdmin) {
        email = adminEmail
        pwd = password
      } else {
        // Convert phone to fake email
        const cleanPhone = phone.replace(/\D/g, '')
        email = `91${cleanPhone}@communityfund.local`
        pwd = password || `CF${cleanPhone}@fund`
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd })
      if (error) { toast.error('Invalid mobile number or password'); setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles').select('*').eq('id', data.user.id).single()

      if (profile?.status === 'pending') {
        await supabase.auth.signOut()
        toast.error('Your account is pending admin approval. Please wait.')
        setLoading(false); return
      }
      if (profile?.status === 'rejected') {
        await supabase.auth.signOut()
        toast.error('Your account was rejected. Contact admin.')
        setLoading(false); return
      }

      toast.success('Welcome back!')
      if (profile?.role === 'admin') navigate('/')
      else navigate('/member')
    } catch (err) {
      toast.error(err.message)
    } finally { setLoading(false) }
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

        {/* Toggle admin/member */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button onClick={() => setIsAdmin(false)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors
              ${!isAdmin ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>
            Member Login
          </button>
          <button onClick={() => setIsAdmin(true)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors
              ${isAdmin ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>
            Admin Login
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {isAdmin ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
              <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="admin@email.com" />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-500">+91</span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))}
                  maxLength={10} required
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="10-digit mobile number" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              required={isAdmin}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={isAdmin ? '••••••••' : 'Leave blank to use default password'} />
            {!isAdmin && (
              <p className="text-xs text-gray-400 mt-1">Default: CF[mobilenumber]@fund</p>
            )}
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-500 mb-3">New to the community fund?</p>
          <Link to="/register"
            className="flex items-center justify-center gap-2 w-full border-2 border-indigo-200 text-indigo-600 font-medium py-2.5 rounded-lg hover:bg-indigo-50">
            <UserPlus className="w-4 h-4" /> Register as Member
          </Link>
        </div>
      </div>
    </div>
  )
}
