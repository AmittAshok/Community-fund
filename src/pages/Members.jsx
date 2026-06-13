import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Members() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ full_name:'', phone:'', email:'', address:'', upi_id:'' })

  useEffect(() => { loadMembers() }, [])

  async function loadMembers() {
    const { data } = await supabase.from('members').select('*').order('created_at', { ascending: false })
    setMembers(data || [])
    setLoading(false)
  }

  async function addMember(e) {
    e.preventDefault()
    const { error } = await supabase.from('members').insert([form])
    if (error) toast.error(error.message)
    else { toast.success('Member added!'); setShowForm(false); setForm({ full_name:'', phone:'', email:'', address:'', upi_id:'' }); loadMembers() }
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
            {[['full_name','Full Name','text',true],['phone','Phone Number','tel',true],
              ['email','Email','email',false],['upi_id','UPI / PhonePe Number','text',false],
              ['address','Address','text',false]].map(([field, label, type, required]) => (
              <div key={field} className={field === 'address' ? 'md:col-span-2' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type={type} required={required} value={form[field]}
                  onChange={e => setForm({...form, [field]: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            ))}
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
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
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
