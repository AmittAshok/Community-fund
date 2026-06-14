import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IndianRupee, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '',
    password: '', confirm_password: '', address: '', upi_id: ''
  })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.full_name.trim()) e.full_name = 'Full name is required'
    else if (!/^[a-zA-Z\s]{3,}$/.test(form.full_name.trim())) e.full_name = 'Enter valid full name (letters only)'
    if (!form.phone.trim()) e.phone = 'Phone is required'
    else if (!/^[6-9]\d{9}$/.test(form.phone.trim())) e.phone = 'Enter valid 10-digit Indian mobile number'
    if (!form.email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter valid email'
    if (!form.password) e.password = 'Password is required'
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters'
    if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match'
    return e
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setLoading(true)
    try {
      // Sign up with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.full_name, role: 'member' }
        }
      })
      if (error) throw error

      // Create member record
      await supabase.from('members').insert([{
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim() || null,
        upi_id: form.upi_id.trim() || null,
        is_active: false, // inactive until admin approves
      }])

      // Update profile with phone
      await supabase.from('profiles')
        .update({ phone: form.phone.trim(), full_name: form.full_name.trim() })
        .eq('id', data.user.id)

      setDone(true)
    } catch (err) {
      if (err.message.includes('unique')) toast.error('Email already registered')
      else toast.error(err.message)
    } finally { setLoading(false) }
  }

  if (done) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✓</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Submitted!</h2>
        <p className="text-gray-500 text-sm mb-6">
          Your registration is pending admin approval. You will be able to login once the admin approves your account.
        </p>
        <Link to="/login"
          className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700">
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-indigo-100 p-3 rounded-full mb-3">
            <IndianRupee className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Join Community Fund</h1>
          <p className="text-gray-500 text-sm mt-1">Fill in your details to register</p>
        </div>
        <form onSubmit={handleRegister} className="space-y-4">
          {[
            ['full_name','Full Name','text','e.g. Rajesh Kumar'],
            ['phone','Phone Number','tel','10-digit mobile number'],
            ['email','Email Address','email','your@email.com'],
            ['upi_id','UPI / PhonePe Number','text','optional — name@upi or 10 digits'],
            ['address','Address','text','optional'],
          ].map(([field, label, type, placeholder]) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} value={form[field]} placeholder={placeholder}
                onChange={e => setForm({...form, [field]: e.target.value})}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2
                  ${errors[field] ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`} />
              {errors[field] && <p className="text-xs text-red-500 mt-1">⚠ {errors[field]}</p>}
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              placeholder="minimum 6 characters"
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2
                ${errors.password ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`} />
            {errors.password && <p className="text-xs text-red-500 mt-1">⚠ {errors.password}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type="password" value={form.confirm_password}
              onChange={e => setForm({...form, confirm_password: e.target.value})}
              placeholder="repeat password"
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2
                ${errors.confirm_password ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`} />
            {errors.confirm_password && <p className="text-xs text-red-500 mt-1">⚠ {errors.confirm_password}</p>}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            Your registration will be reviewed by the admin before you can login.
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Submitting...' : 'Submit Registration'}
          </button>
          <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-indigo-600">
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Link>
        </form>
      </div>
    </div>
  )
}
