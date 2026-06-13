import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

  useEffect(() => {
    supabase.from('payments').select(`*, members(full_name), loans(amount)`)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setPayments(data || []); setLoading(false) })
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-gray-500 text-sm">{payments.length} total payments</p>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? <div className="p-8 text-center text-gray-400">Loading...</div> : payments.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No payments recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>{['Member','Amount','Type','Mode','Reference','Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.members?.full_name}</td>
                    <td className="px-4 py-3">{fmt(p.amount)}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs">{p.payment_type}</span></td>
                    <td className="px-4 py-3 text-gray-500">{p.payment_mode}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{p.upi_reference || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
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
