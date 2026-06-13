import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { UserPlus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Members() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
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
    const { data: member, error } = await supabase
      .from('members')
      .insert([{
        full_name: form.full_name, phone: form.phone,
        email: form.email, address: form.address, upi_id: form.upi_id,
      }])
      .select().single()
    if (error) { toast.error(error.message); return }

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
        notes: `Contribution from ${form.full_name}`,
      }])
    }

    toast.success('Member added!')
    setShowForm(false)
    setForm({ full_name: '', phone: '', email: '', address: '', upi_id: '', contribution: '' })
    loadMembers()
  }

  async function deleteMember(member) {
    // Check if member has active loans
    const { data: activeLoans } = await supabase
      .from('loans')
      .select('id')
      .eq('member_id', member.id)
      .in('status', ['pending', 'approved', 'active', 'overdue'])

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
            {[
              ['full_name','Full Name','text',true],
              ['phone','Phone Number','tel',true],
              ['email','Email','email',false],
              ['upi_id','UPI / PhonePe Number','text',false],
            ].map(([field, label, type, required]) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && ' *'}</label>
                <input type={type} required={required} value={form[field]}
                  onChange={e => setForm({...form, [field]: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Contribution (₹)
                <span className="ml-1 text-xs text-gray-400 font-normal">— adds to fund balance</span>
              </label>
              <input type="number" min="0" value={form.contribution}
                onChange={e => setForm({...form, contribution: e.target.value})}
                placeholder="e.g. 4000"
                className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <p className="text-xs text-green-600 mt-1">This amount will be added to the total fund balance</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input type="text" value={form.address}
                onChange={e => setForm({...form, address: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700">Save Member</button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-6 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
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

      {/* Delete confirmation modal */}
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
