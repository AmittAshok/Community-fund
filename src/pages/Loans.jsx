import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, CheckCircle, XCircle, Eye, IndianRupee } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Loans() {
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('pending')
  const navigate = useNavigate()
  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

  useEffect(() => { loadLoans() }, [])

  async function loadLoans() {
    const { data } = await supabase
      .from('loans')
      .select(`*, 
        members!loans_member_id_fkey(full_name, phone, email),
        guarantor1:members!loans_guarantor1_id_fkey(full_name, phone),
        guarantor2:members!loans_guarantor2_id_fkey(full_name, phone)
      `)
      .order('created_at', { ascending: false })
    setLoans(data || [])
    setLoading(false)
  }

  async function approveLoan(loan) {
    const { error } = await supabase.from('loans')
      .update({ status: 'approved', approved_date: new Date().toISOString().split('T')[0] })
      .eq('id', loan.id)
    if (error) toast.error(error.message)
    else { toast.success('Loan approved!'); loadLoans(); setSelected(null) }
  }

  async function rejectLoan(loan) {
    const reason = prompt('Reason for rejection (optional):')
    const { error } = await supabase.from('loans')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', loan.id)
    if (error) toast.error(error.message)
    else { toast.success('Loan rejected'); loadLoans(); setSelected(null) }
  }

  async function markDisbursed(loan) {
    // Mark loan as active + record transaction
    const { error } = await supabase.from('loans')
      .update({ 
        status: 'active', 
        disbursed_date: new Date().toISOString().split('T')[0] 
      })
      .eq('id', loan.id)
    if (error) { toast.error(error.message); return }

    // Get last balance
    const { data: lastTxn } = await supabase
      .from('transactions')
      .select('balance_after')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const prevBalance = lastTxn?.balance_after || 0

    // Record outgoing transaction
    await supabase.from('transactions').insert([{
      txn_type: 'loan_disbursement',
      member_id: loan.member_id,
      loan_id: loan.id,
      amount: loan.amount,
      direction: 'O',
      balance_after: prevBalance - loan.amount,
      notes: `Loan disbursed to ${loan.members?.full_name}`,
    }])

    toast.success('Loan marked as disbursed! Fund balance updated.')
    loadLoans()
    setSelected(null)
  }

  const statusColor = (s) => ({
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    active:   'bg-green-100 text-green-700',
    overdue:  'bg-red-100 text-red-700',
    paid:     'bg-gray-100 text-gray-600',
    rejected: 'bg-red-50 text-red-400',
  }[s] || 'bg-gray-100 text-gray-600')

  const tabs = ['pending', 'approved', 'active', 'overdue', 'paid', 'rejected']
  const filtered = loans.filter(l => l.status === tab)
  const pendingCount = loans.filter(l => l.status === 'pending').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loans</h1>
          <p className="text-gray-500 text-sm">{loans.length} total loans</p>
        </div>
        <button onClick={() => navigate('/loans/apply')}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          <PlusCircle className="w-4 h-4" /> New Application
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize whitespace-nowrap transition-colors relative
              ${tab === t ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
            {t === 'pending' && pendingCount > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Loans table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No {tab} loans</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>{['Member','Amount','Purpose','Applied','Payment To','Status','Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(loan => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{loan.members?.full_name}</p>
                      <p className="text-xs text-gray-400">{loan.members?.phone}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-indigo-700">{fmt(loan.amount)}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-32 truncate">{loan.purpose}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(loan.applied_date).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs uppercase text-indigo-600">{loan.payment_method}</p>
                      <p className="text-xs text-gray-500">{loan.upi_number || loan.bank_account || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(loan.status)}`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(loan)}
                        className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium">
                        <Eye className="w-3 h-3" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg">Loan Application Details</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Applicant */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Applicant</p>
                <p className="font-semibold text-gray-900">{selected.members?.full_name}</p>
                <p className="text-sm text-gray-500">{selected.members?.phone} · {selected.members?.email}</p>
              </div>

              {/* Loan details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-indigo-50 rounded-lg p-3">
                  <p className="text-xs text-indigo-500 mb-1">Amount</p>
                  <p className="font-bold text-indigo-700 text-lg">{fmt(selected.amount)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Applied On</p>
                  <p className="font-medium">{new Date(selected.applied_date).toLocaleDateString('en-IN')}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="text-xs text-gray-500 mb-1">Purpose</p>
                <p className="font-medium">{selected.purpose}</p>
              </div>

              {/* Payment info */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-xs font-medium text-green-700 uppercase mb-2 flex items-center gap-1">
                  <IndianRupee className="w-3 h-3" /> Send Money To
                </p>
                <p className="font-bold text-green-800 text-lg">
                  {selected.payment_method === 'upi' ? selected.upi_number : selected.bank_account}
                </p>
                <p className="text-xs text-green-600 uppercase mt-1">
                  via {selected.payment_method === 'upi' ? 'PhonePe / GPay / UPI' : `Bank — ${selected.bank_name} · IFSC: ${selected.bank_ifsc}`}
                </p>
              </div>

              {/* Guarantors */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="text-xs text-gray-500 mb-1">Guarantor 1</p>
                  <p className="font-medium">{selected.guarantor1?.full_name || '—'}</p>
                  <p className="text-xs text-gray-400">{selected.guarantor1?.phone}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="text-xs text-gray-500 mb-1">Guarantor 2</p>
                  <p className="font-medium">{selected.guarantor2?.full_name || '—'}</p>
                  <p className="text-xs text-gray-400">{selected.guarantor2?.phone}</p>
                </div>
              </div>

              {/* Signatures */}
              {selected.borrower_signature_url && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-2">Signatures</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[['Borrower', selected.borrower_signature_url],
                      ['Guarantor 1', selected.guarantor1_signature_url],
                      ['Guarantor 2', selected.guarantor2_signature_url]].map(([label, url]) => (
                      <div key={label} className="text-center">
                        <img src={url} alt={label} className="border rounded-lg w-full h-16 object-contain bg-gray-50" />
                        <p className="text-xs text-gray-400 mt-1">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejection reason */}
              {selected.rejection_reason && (
                <div className="bg-red-50 rounded-lg p-3 text-sm text-red-600">
                  <p className="font-medium">Rejection reason:</p>
                  <p>{selected.rejection_reason}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                {selected.status === 'pending' && <>
                  <button onClick={() => rejectLoan(selected)}
                    className="flex-1 flex items-center justify-center gap-2 border border-red-300 text-red-600 py-2.5 rounded-lg hover:bg-red-50">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button onClick={() => approveLoan(selected)}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                </>}
                {selected.status === 'approved' && (
                  <button onClick={() => markDisbursed(selected)}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700">
                    <IndianRupee className="w-4 h-4" /> Mark as Disbursed (Money Sent)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
