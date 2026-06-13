import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { UserPlus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const validate = (form) => {
  const errors = {}
  if (!form.full_name.trim()) errors.full_name = 'Full name is required'
  else if (form.full_name.trim().length < 3) errors.full_name = 'Name must be at least 3 characters'
  else if (!/^[a-zA-Z\s]+$/.test(form.full_name.trim())) errors.full_name = 'Name should only contain letters'

  if (!form.phone.trim()) errors.phone = 'Phone number is required'
  else if (!/^[6-9]\d{9}$/.test(form.phone.trim())) errors.phone = 'Enter valid 10-digit Indian mobile number'

  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email address'

  if (form.upi_id && !/^[\w.\-]+@[\w]+$|^\d{10}$/.test(form.upi_id.trim())) errors.upi_id = 'Enter valid UPI ID (e.g. name@upi or 10-digit number)'

  if (form.contribution && (isNaN(form.contribution) || parseFloat(form.contribution) < 0))
    errors.contribution = 'Contribution must be a positive number'
  if (form.contribution && parseFloat(form.contribution) > 100000)
    errors.contribution = 'Contribution seems too high — please verify'

  return errors
}

export default function Members() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [form, setForm] = useState({
    full_name: '', phone: '', email: '',
    address: '', upi_id: '', contribution: ''
  })

  useEffect(() => { loadMembers() }, [])

  async function loadMembers() {
    const { data } = await supabase.from('members').select('*').order('created_at', { ascending: false })
    setMembers(data || [])
    setLoading(false)
  }

  const handleChange = (field, value) => {
    const updated = { ...form, [field]: value }
    setForm(updated)
    if (touched[field]) {
      const errs = validate(updated)
      setErrors(e => ({ ...e, [field]: errs[field] }))
    }
  }

  const handleBlur = (field) => {
    setTouched(t => ({ ...t, [field]: true }))
    const errs = validate(form)
    setErrors(e => ({ ...e, [field]: errs[field] }))
  }

  async function addMember(e) {
    e.preventDefault()
    // Mark all fields touched
    setTouched({ full_name: true, phone: true, email: true, upi_id: true, contribution: true })
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) { toast.error('Please fix the errors below'); return }

    const { data: member, error } = await supabase
      .from('members')
      .insert([{
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        upi_id: form.upi_id.trim() || null,
      }])
      .select().single()
    if (error) {
      if (error.message.includes('unique')) toast.error('This phone number is already registered')
      else toast.error(error.message)
      return
    }

    if (form.contribution && parseFloat(form.contribution) > 0) {
      await supabase.from('contributions').insert([{
        member_id: member.id, amount: parseFloat(form.contribution),
        payment_mode: 'Cash', notes: 'Initial contribution on joining',
      }])
      const { data: lastTxn } = await supabase.from('transactions')
        .select('balance_after').order('created_at', { ascending: false }).limit(1).single()
      const prevBalance = lastTxn?.balance_after || 0
      await supabase.from('transactions').insert([{
        txn_type: 'contribution', member_id: member.id,
        amount: parseFloat(form.contribution), direction: 'I',
        balance_after: prevBalance + parseFloat(form.contribution),
        notes: `Contribution from ${form.full_name.trim()}`,
      }])
    }

    toast.success('Member added successfully!')
    setShowForm(false)
    setForm({ full_name: '', phone: '', email: '', address: '', upi_id: '', contribution: '' })
    setErrors({})
    setTouched({})
    loadMembers()
  }

  async function deleteMember(member) {
    const { data: activeLoans } = await supabase.from('loans').select('id')
      .eq('member_id', member.id).in('status', ['pending', 'approved', 'active', 'overdue'])
    if (activeLoans && activeLoans.length > 0) {
      toast.error('Cannot delete — member has active or pending loans')
      setDeleteConfirm(null)
      return
    }
    const { error } = await supabase.from('members').delete().eq('id', member.id)
    if (error) toast.error(error.message)
    else { toast.success('Member deleted'); loadMembers() }
    setDeleteConfirm(null)
  }

  const Field = ({ field, label, type = 'text', required = false, placeholder = '' }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={form[field]}
        onChange={e => handleChange(field, e.target.value)}
        onBlur={() => handleBlur(field)}
        placeholder={placeholder}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors
          ${errors[field] && touched[field]
            ? 'border-red-400 focus:ring-red-400 bg-red-50'
            : 'border-gray-300 focus:ring-indigo-500'}`}
      />
      {errors[field] && touched[field] && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">⚠ {errors[field]}</p>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-500 text-sm">{members.length} total members</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setErrors({}); setTouched({}) }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          <UserPlus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold mb-4">New Member</h2>
          <form onSubmit={addMember} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field field="full_name" label="Full Name" required placeholder="e.g. Rajesh Kumar" />
            <Field field="phone" label="Phone Number" type="tel" required placeholder="10-digit mobile number" />
            <Field field="email" label="Email" type="email" placeholder="optional" />
            <Field field="upi_id" label="UPI / PhonePe Number" placeholder="name@upi or 10-digit number" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Contribution (₹)
                <span className="ml-1 text-xs text-gray-400 font-normal">— adds to fund balance</span>
              </label>
              <input
                type="number" min="0" value={form.contribution}
                onChange={e => handleChange('contribution', e.target.value)}
                onBlur={() => handleBlur('contribution')}
                placeholder="e.g. 4000"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2
                  ${errors.contribution && touched.contribution
                    ? 'border-red-400 focus:ring-red-400 bg-red-50'
                    : 'border-green-300 focus:ring-green-500'}`}
              />
              {errors.contribution && touched.contribution
                ? <p className="text-xs text-red-500 mt-1">⚠ {errors.contribution}</p>
                : <p className="text-xs text-green-600 mt-1">This amount will be added to the total fund balance</p>
              }
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" value={form.address}
                onChange={e => handleChange('address', e.target.value)}
                placeholder="optional"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit"
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700">
                Save Member
              </button>
              <button type="button" onClick={() => { setShowForm(false); setErrors({}); setTouched({}) }}
                className="border border-gray-300 px-6 py-2 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? <div className="p-8 text-center text-gray-400">Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>{['#','Name','Phone','Email','UPI ID','Joined','Status','Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map((m, i) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{i+1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{m.full_name}</td>
                    <td className="px-4 py-3">{m.phone}</td>
                    <td className="px-4 py-3 text-gray-500">{m.email || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{m.upi_id || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(m.joined_date).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium
                        ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {m.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDeleteConfirm(m)}
                        className="flex items-center gap-1 text-red-400 hover:text-red-600 text-xs font-medium">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="font-bold text-lg">Delete Member</h2>
            </div>
            <p className="text-gray-600 text-sm mb-2">
              Are you sure you want to delete <strong>{deleteConfirm.full_name}</strong>?
            </p>
            <p className="text-red-500 text-xs mb-6">
              This cannot be undone. Members with active loans cannot be deleted.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => deleteMember(deleteConfirm)}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm hover:bg-red-700">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
