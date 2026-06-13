import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { PlusCircle } from 'lucide-react'

export default function Loans() {
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

  useEffect(() => {
    supabase.from('loans').select(`*, members(full_name, phone)`).order('created_at', { ascending: false })
      .then(({ data }) => { setLoans(data || []); setLoading(false) })
  }, [])

  const statusColor = (s) => ({
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    active:   'bg-green-100 text-green-700',
    overdue:  'bg-red-100 text-red-700',
    paid:     'bg-gray-100 text-gray-600',
    rejected: 'bg-red-50 text-red-400',
  }[s] || 'bg-gray-100 text-gray-600')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loans</h1>
          <p className="text-gray-500 text-sm">{loans.length} total loans</p>
        </div>
        <button onClick={() => navigate('/loans/apply')}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          <PlusCircle className="w-4 h-4" /> New Loan Application
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? <div className="p-8 text-center text-gray-400">Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>{['Member','Amount','Purpose','Applied','Status','Rate'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loans.map(loan => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{loan.members?.full_name}</td>
                    <td className="px-4 py-3">{fmt(loan.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{loan.purpose}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(loan.applied_date).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(loan.status)}`}>{loan.status}</span></td>
                    <td className="px-4 py-3">{loan.interest_rate_normal}% / {loan.interest_rate_overdue}%</td>
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
