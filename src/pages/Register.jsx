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
    full_name: '', phone: '', address: '', upi_id: ''
  })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.full_name.trim()) e.full_name = 'Full name is required'
    else if (!/^[a-zA-Z\s]{3,}$/.test(form.full_name.trim())) e.full_name = 'Letters only, min 3 characters'
    if (!form.phone.trim()) e.phone = 'Phone number is required'
    else if (!/^[6-9]\d{9}$/.test(form.phone.trim())) e.phone = 'Enter valid 10-digit Indian mobile number'
    return e
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setLoading(true)
    try {
      // Use phone as email: 91XXXXXXXXXX@communityfund.local
      const fakeEmail = `91${form.phone.trim()}@communityfund.local`
      const defaultPassword = `CF${form.phone.trim()}@fund`

      const { data, error } = await supabase.auth.signUp({
        email: fakeEmail,
        password: defaultPassword,
        options: {
          data: { full_name: form.full_name.trim(), role: 'member', phone: form.phone.trim() }
        }
      })
      if (error) {
        if (error.message.includes('already')) toast.error('This phone number is already registered')
        else toast.error(error.message)
        setLoading(false); return
      }

      // Add to members table (inactive until approved)
      await supabase.from('members').insert([{
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: fakeEmail,
        address: form.address.trim() || null,
        upi_id: form.upi_id.trim() || null,
        is_active: false,
      }])

      // Update profile
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          role: 'member',
          status: 'pending',
        })
      }

      setDone(true)
    } catch (err) {
      toast.error(err.message)
    } finally { setLoading(false) }
  }

  if (done) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-indigo-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">✓</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration Submitted!</h2>
        <div className="bg-indigo-50 rounded-xl p-4 mb-6 text-left space-y-2">
          <p className="text-sm font-medium text-indigo-900">Your login details:</p>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Mobile</span>
              <span className="font-mono font-medium">{form.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Password</span>
              <span className="font-mono font-medium">CF{form.phone}@fund</span>
            </div>
          </div>
          <p className="text-xs text-indigo-500 mt-2">
            Save these details. You can login once admin approves your account.
          </p>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          Admin will review and approve your registration. You'll be notified when approved.
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
          <p className="text-gray-500 text-sm mt-1">Register with your mobile number</p>
        </div>
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input type="text" value={form.full_name} placeholder="e.g. Rajesh Kumar"
              onChange={e => setForm({...form, full_name: e.target.value})}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2
                ${errors.full_name ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`} />
            {errors.full_name && <p className="text-xs text-red-500 mt-1">⚠ {errors.full_name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number *</label>
            <div className="flex gap-2">
              <span className="flex items-center px-3 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-500">+91</span>
              <input type="tel" value={form.phone} placeholder="10-digit mobile number"
                onChange={e => setForm({...form, phone: e.target.value.replace(/\D/g,'')})}
                maxLength={10}
                className={`flex-1 border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2
                  ${errors.phone ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:ring-indigo-500'}`} />
            </div>
            {errors.phone && <p className="text-xs text-red-500 mt-1">⚠ {errors.phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">UPI / PhonePe Number <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" value={form.upi_id} placeholder="name@upi or 10-digit number"
              onChange={e => setForm({...form, upi_id: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" value={form.address} placeholder="your address"
              onChange={e => setForm({...form, address: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            Your login password will be auto-generated as: <strong>CF[mobilenumber]@fund</strong><br/>
            e.g. for 9876543210 → <strong>CF9876543210@fund</strong>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Submitting...' : 'Register'}
          </button>
          <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-indigo-600">
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Link>
        </form>
      </div>
    </div>
  )
}
