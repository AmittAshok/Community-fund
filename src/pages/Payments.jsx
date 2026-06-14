import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PlusCircle, IndianRupee, X } from 'lucide-react'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [activeLoans, setActiveLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [interestBreakdown, setInterestBreakdown] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [filterType, setFilterType] = useState('all')

  const [form, setForm] = useState({
    loan_id: '',
    payment_type: 'interest',
    amount: '',
    payment_mode: 'UPI',
    upi_reference: '',
    notes: '',
    payment_date: dayjs().format('YYYY-MM-DD'),
  })

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: pays }, { data: loans }] = await Promise.all([
      supabase.from('payments')
        .select(`*, members(full_name), loans(amount)`)
        .order('created_at', { ascending: false }),
      supabase.from('loans')
        .select(`*, members!loans_member_id_fkey(full_name, phone)`)
        .in('status', ['active', 'overdue'])
        .order('created_at', { ascending: false }),
    ])
    setPayments(pays || [])
    setActiveLoans(loans || [])
    setLoading(false)
  }

  // Calculate interest breakdown for selected loan
  function calcInterest(loan) {
    if (!loan?.disbursed_date) return []
    const disbursed = dayjs(loan.disbursed_date)
    const now = dayjs()
    const monthsElapsed = now.diff(disbursed, 'month')
    const breakdown = []
    for (let m = 1; m <= monthsElapsed; m++) {
      const rate = m <= 3
        ? parseFloat(loan.interest_rate_normal || 2)
        : parseFloat(loan.interest_rate_overdue || 5)
      const monthLabel = disbursed.add(m, 'month').format('YYYY-MM')
      const interest = parseFloat((loan.amount * rate / 100).toFixed(2))
      breakdown.push({ month: m, month_label: monthLabel, rate, interest })
    }
    return breakdown
  }

  async function handleLoanSelect(loanId) {
    const loan = activeLoans.find(l => l.id === loanId)
    setSelectedLoan(loan)

    if (loan) {
      // Get already paid months
      const { data: paidMonths } = await supabase
        .from('interest_log')
        .select('month_year')
        .eq('loan_id', loanId)
        .eq('is_paid', true)

      const paidSet = new Set((paidMonths || []).map(p => p.month_year))
      const breakdown = calcInterest(loan).map(b => ({
        ...b,
        is_paid: paidSet.has(b.month_label)
      }))
      setInterestBreakdown(breakdown)

      // Auto-calculate due amount
      if (form.payment_type === 'interest') {
        const unpaidTotal = breakdown
          .filter(b => !b.is_paid)
          .reduce((sum, b) => sum + b.interest, 0)
        setForm(f => ({ ...f, loan_id: loanId, amount: unpaidTotal.toFixed(2) }))
      } else {
        setForm(f => ({ ...f, loan_id: loanId, amount: loan.amount }))
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.loan_id) { toast.error('Select a loan'); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error('Enter valid amount'); return }

    setSubmitting(true)
    try {
      const loan = selectedLoan

      // 1. Record payment
      const { data: payment, error: payError } = await supabase
        .from('payments')
        .insert([{
          loan_id: form.loan_id,
          member_id: loan.member_id,
          amount: parseFloat(form.amount),
          payment_date: form.payment_date,
          payment_type: form.payment_type,
          payment_mode: form.payment_mode,
          upi_reference: form.upi_reference || null,
          notes: form.notes || null,
        }])
        .select().single()

      if (payError) throw payError

      // 2. Update interest_log if interest payment
      if (form.payment_type === 'interest') {
        const unpaidMonths = interestBreakdown.filter(b => !b.is_paid)
        for (const month of unpaidMonths) {
          await supabase.from('interest_log').upsert({
            loan_id: form.loan_id,
            month_year: month.month_label,
            months_elapsed: month.month,
            rate_applied: month.rate,
            principal_os: loan.amount,
            interest_amount: month.interest,
            is_paid: true,
            paid_date: form.payment_date,
          }, { onConflict: 'loan_id,month_year' })
        }
      }

      // 3. Update transaction log
      const { data: lastTxn } = await supabase
        .from('transactions')
        .select('balance_after')
        .order('created_at', { ascending: false })
        .limit(1).single()

      const prevBalance = lastTxn?.balance_after || 0
      await supabase.from('transactions').insert([{
        txn_type: form.payment_type === 'interest'
          ? 'interest_payment'
          : form.payment_type === 'principal'
          ? 'principal_repayment'
          : 'full_repayment',
        member_id: loan.member_id,
        loan_id: form.loan_id,
        amount: parseFloat(form.amount),
        direction: 'I',
        balance_after: prevBalance + parseFloat(form.amount),
        notes: `${form.payment_type} payment from ${loan.members?.full_name}`,
      }])

      // 4. If full repayment or principal — mark loan as paid
      if (form.payment_type === 'full_repayment') {
        await supabase.from('loans')
          .update({ status: 'paid' })
          .eq('id', form.loan_id)
        toast.success('Loan marked as fully paid!')
      } else if (form.payment_type === 'principal') {
        // Check if fully paid
        const { data: allPayments } = await supabase
          .from('payments')
          .select('amount')
          .eq('loan_id', form.loan_id)
          .in('payment_type', ['principal', 'full_repayment'])
        const totalPaid = allPayments?.reduce((s, p) => s + parseFloat(p.amount), 0) || 0
        if (totalPaid >= loan.amount) {
          await supabase.from('loans').update({ status: 'paid' }).eq('id', form.loan_id)
          toast.success('Loan fully repaid and closed!')
        } else {
          toast.success(`Payment recorded! Remaining: ${fmt(loan.amount - totalPaid)}`)
        }
      } else {
        toast.success('Interest payment recorded!')
      }

      // Reset form
      setForm({
        loan_id: '', payment_type: 'interest', amount: '',
        payment_mode: 'UPI', upi_reference: '', notes: '',
        payment_date: dayjs().format('YYYY-MM-DD'),
      })
      setSelectedLoan(null)
      setInterestBreakdown([])
      setShowForm(false)
      loadAll()
    } catch (err) {
      toast.error(err.message)
    } finally { setSubmitting(false) }
  }

  const filtered = filterType === 'all'
    ? payments
    : payments.filter(p => p.payment_type === filterType)

  const typeColor = (t) => ({
    interest: 'bg-blue-100 text-blue-700',
    principal: 'bg-green-100 text-green-700',
    full_repayment: 'bg-purple-100 text-purple-700',
  }[t] || 'bg-gray-100 text-gray-600')

  const typeLabel = (t) => ({
    interest: 'Interest',
    principal: 'Principal',
    full_repayment: 'Full Repayment',
  }[t] || t)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-500 text-sm">{payments.length} total payments recorded</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          <PlusCircle className="w-4 h-4" /> Record Payment
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          ['Interest Collected',
            payments.filter(p => p.payment_type === 'interest')
              .reduce((s, p) => s + parseFloat(p.amount), 0), 'bg-blue-50 text-blue-700'],
          ['Principal Repaid',
            payments.filter(p => p.payment_type !== 'interest')
              .reduce((s, p) => s + parseFloat(p.amount), 0), 'bg-green-50 text-green-700'],
          ['Active Loans', activeLoans.length, 'bg-orange-50 text-orange-700'],
        ].map(([label, val, cls]) => (
          <div key={label} className={`rounded-xl p-4 ${cls}`}>
            <p className="text-xs font-medium opacity-70">{label}</p>
            <p className="text-xl font-bold mt-1">
              {typeof val === 'number' && label !== 'Active Loans' ? fmt(val) : val}
            </p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[['all','All'],['interest','Interest'],['principal','Principal'],['full_repayment','Full Repayment']].map(([val, label]) => (
          <button key={val} onClick={() => setFilterType(val)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap
              ${filterType === val ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Payments table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <IndianRupee className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No payments recorded yet</p>
            <button onClick={() => setShowForm(true)}
              className="mt-3 text-indigo-600 text-sm hover:underline">
              Record first payment →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>{['Member','Type','Amount','Date','Mode','Reference','Notes'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.members?.full_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColor(p.payment_type)}`}>
                        {typeLabel(p.payment_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-700">{fmt(p.amount)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(p.payment_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.payment_mode}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {p.upi_reference || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{p.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record payment modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-screen overflow-y-auto">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-lg">Record Payment</h2>
              <button onClick={() => {
                setShowForm(false); setSelectedLoan(null)
                setInterestBreakdown([])
                setForm({ loan_id: '', payment_type: 'interest', amount: '',
                  payment_mode: 'UPI', upi_reference: '', notes: '',
                  payment_date: dayjs().format('YYYY-MM-DD') })
              }}>
                <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* Payment type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['interest', 'Interest Payment', 'Monthly interest due'],
                    ['principal', 'Principal Payment', 'Partial loan repayment'],
                    ['full_repayment', 'Full Repayment', 'Close the loan'],
                  ].map(([val, label, sub]) => (
                    <button key={val} type="button"
                      onClick={() => {
                        setForm(f => ({ ...f, payment_type: val }))
                        if (selectedLoan) {
                          if (val === 'interest') {
                            const unpaid = interestBreakdown
                              .filter(b => !b.is_paid)
                              .reduce((s, b) => s + b.interest, 0)
                            setForm(f => ({ ...f, payment_type: val, amount: unpaid.toFixed(2) }))
                          } else if (val === 'full_repayment') {
                            setForm(f => ({ ...f, payment_type: val, amount: selectedLoan.amount }))
                          }
                        }
                      }}
                      className={`p-3 rounded-lg border-2 text-left transition-colors
                        ${form.payment_type === val
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'}`}>
                      <p className="font-medium text-xs text-gray-900">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Select loan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Loan *</label>
                {activeLoans.length === 0 ? (
                  <p className="text-sm text-gray-400 p-3 bg-gray-50 rounded-lg">No active loans found</p>
                ) : (
                  <select value={form.loan_id}
                    onChange={e => { setForm(f => ({ ...f, loan_id: e.target.value })); handleLoanSelect(e.target.value) }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select member loan</option>
                    {activeLoans.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.members?.full_name} — {fmt(l.amount)} ({l.status})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Loan details + interest breakdown */}
              {selectedLoan && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Loan Amount</span>
                    <span className="font-semibold">{fmt(selectedLoan.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Disbursed On</span>
                    <span>{selectedLoan.disbursed_date
                      ? new Date(selectedLoan.disbursed_date).toLocaleDateString('en-IN')
                      : '—'}</span>
                  </div>
                  {form.payment_type === 'interest' && interestBreakdown.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">Month-wise Interest:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {interestBreakdown.map(b => (
                          <div key={b.month_label}
                            className={`flex justify-between text-xs px-2 py-1 rounded
                              ${b.is_paid
                                ? 'bg-green-50 text-green-600'
                                : 'bg-orange-50 text-orange-700'}`}>
                            <span>{b.month_label} ({b.rate}%)</span>
                            <span>{b.is_paid ? '✓ Paid' : `Due: ${fmt(b.interest)}`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
                <input type="number" min="1" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter amount" />
                {selectedLoan && form.payment_type === 'interest' && (
                  <p className="text-xs text-orange-600 mt-1">
                    Auto-calculated from unpaid months above
                  </p>
                )}
              </div>

              {/* Payment date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
                <input type="date" value={form.payment_date}
                  onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              {/* Payment mode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Mode *</label>
                <div className="flex gap-2 flex-wrap">
                  {['UPI', 'Cash', 'Bank Transfer', 'PhonePe', 'GPay'].map(mode => (
                    <button key={mode} type="button"
                      onClick={() => setForm(f => ({ ...f, payment_mode: mode }))}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors
                        ${form.payment_mode === mode
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* UPI reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  UPI / Transaction Reference
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <input type="text" value={form.upi_reference}
                  onChange={e => setForm(f => ({ ...f, upi_reference: e.target.value }))}
                  placeholder="e.g. UTR123456789"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea rows={2} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              {/* Summary before submit */}
              {selectedLoan && form.amount && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-indigo-800 mb-1">Payment Summary</p>
                  <div className="space-y-1 text-xs text-indigo-700">
                    <div className="flex justify-between">
                      <span>Member</span>
                      <span>{selectedLoan.members?.full_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Type</span>
                      <span className="capitalize">{form.payment_type.replace('_',' ')}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Amount</span>
                      <span>{fmt(form.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mode</span>
                      <span>{form.payment_mode}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button"
                  onClick={() => { setShowForm(false); setSelectedLoan(null); setInterestBreakdown([]) }}
                  className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
                  {submitting ? 'Recording...' : '✓ Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
