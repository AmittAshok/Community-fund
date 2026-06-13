import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Members() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
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

  async function addMember(e) {
    e.preventDefault()

    // 1. Insert member
    const { data: member, error } = await supabase
      .from('members')
      .insert([{
        full_name: form.full_name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        upi_id: form.upi_id,
      }])
      .select()
      .single()

    if (error) { toast.error(error.message); return }

    // 2. If contribution amount entered, record it
    if (form.contribution && parseFloat(form.contribution) > 0) {
      // Add to contributions table
      const { error: contribError } = await supabase.from('contributions').insert([{
        member_id: member.id,
        amount: parseFloat(form.contribution),
        payment_mode: 'Cash',
        notes: 'Initial contribution on joining',
      }])
      if (contribError) toast.error('Member added but contribution failed: ' + contribError.message)

      // Add to transactions table (updates fund balance)
      const { data: lastTxn } = await supabase
        .from('transactions')
        .select('balance_after')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const prevBalance = lastTxn?.balance_after || 0
      await supabase.from('transactions').insert([{
        txn_type: 'contribution',
        member_id: member.id,
        amount: parseFloat(form.contribution),
        direction: 'I',
        balance_after: prevBalance + parseFloat(form.contribution),
        notes: `Contribution from ${form.full_name}`,
      }])
    }

    toast.success('Member added successfully!')
    setShowForm(false)
    setForm({ full_name: '', phone: '', email: '', address: '', upi_id: '', contribution: '' })
    loadMembers()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="text-gray-500 text-sm">{members.length} total members</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          <UserPlus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold mb-4">New Member</h2>
          <form onSubmit={addMember} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input type="text" required value={form.full_name}
                onChange={e => setForm({...form, full_name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
              <input type="tel" required value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UPI / PhonePe Number</label>
              <input type="text" value={form.upi_id}
                onChange={e => setForm({...form, upi_id: e.target.value})}
                placeholder="e.g. 9876543210 or name@upi"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Contribution (₹)
                <span className="ml-1 text-xs text-gray-400 font-normal">— adds to fund balance</span>
              </label>
              <input type="number" min="0" value={form.contribution}
                onChange={e => setForm({...form, contribution: e.target.value})}
                placeholder="e.g. 4000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border-green-300 focus:ring-green-500" />
              <p className="text-xs text-green-600 mt-1">This amount will be added to the total fund balance</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" value={form.address}
                onChange={e => setForm({...form, address: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit"
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700">
                Save Member
              </button>
              <button type="button" onClick={() => setShowForm(false)}
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
                <tr>{['#','Name','Phone','Email','UPI ID','Joined','Status'].map(h => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
