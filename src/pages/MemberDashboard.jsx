import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { IndianRupee, Clock, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react'

export default function MemberDashboard() {
  const { user, profile } = useAuth()
  const [member, setMember] = useState(null)
  const [loans, setLoans] = useState([])
  const [payments, setPayments] = useState([])
  const [fundStats, setFundStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  useEffect(() => {
    if (profile) loadData()
  }, [profile])

  async function loadData() {
    // Get member record by email
    const { data: memberData } = await supabase
      .from('members').select('*').eq('email', user.email).single()
    setMember(memberData)

    if (memberData) {
      // Get member loans with guarantor info
      const { data: loanData } = await supabase
        .from('loans')
        .select(`*,
          guarantor1:members!loans_guarantor1_id_fkey(full_name),
          guarantor2:members!loans_guarantor2_id_fkey(full_name)
        `)
        .eq('member_id', memberData.id)
        .order('created_at', { ascending: false })
      setLoans(loanData || [])

      // Get payments
      const { data: paymentData } = await supabase
        .from('payments').select('*')
        .eq('member_id', memberData.id)
        .order('created_at', { ascending: false })
      setPayments(paymentData || [])
    }

    // Get fund stats (public info only)
    const { data: fund } = await supabase.from('fund_status').select('*').single()
    setFundStats(fund)
    setLoading(false)
  }

  const calcInterest = (loan) => {
    if (!loan.disbursed_date) return { due: 0, months: 0, rate: 2 }
    const disbursed = new Date(loan.disbursed_date)
    const now = new Date()
    const months = Math.floor((now - disbursed) / (1000 * 60 * 60 * 24 * 30))
    const rate = months <= 3 ? loan.interest_rate_normal : loan.interest_rate_overdue
    const due = (loan.amount * rate / 100) * months
    return { due: due.toFixed(2), months, rate }
  }

  const statusColor = (s) => ({
    pending:  'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    active:   'bg-green-100 text-green-700',
    overdue:  'bg-red-100 text-red-700',
    paid:     'bg-gray-100 text-gray-600',
    rejected: 'bg-red-50 text-red-400',
  }[s] || 'bg-gray-100 text-gray-600')

  const statusIcon = (s) => ({
    pending:  <Clock className="w-4 h-4 text-yellow-500" />,
    approved: <CheckCircle className="w-4 h-4 text-blue-500" />,
    active:   <CheckCircle className="w-4 h-4 text-green-500" />,
    overdue:  <AlertCircle className="w-4 h-4 text-red-500" />,
    paid:     <CheckCircle className="w-4 h-4 text-gray-400" />,
    rejected: <AlertCircle className="w-4 h-4 text-red-400" />,
  }[s])

  if (loading) return <div className="text-center text-gray-400 mt-20">Loading your dashboard...</div>

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-indigo-900 text-white rounded-2xl p-5">
        <p className="text-indigo-300 text-sm">Welcome back,</p>
        <h1 className="text-2xl font-bold mt-1">{member?.full_name}</h1>
        <p className="text-indigo-300 text-sm mt-1">{member?.phone} · Member since {member?.joined_date ? new Date(member.joined_date).toLocaleDateString('en-IN') : 'N/A'}</p>
      </div>

      {/* Fund info (public) */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
          <h2 className="font-semibold text-gray-900">Community Fund Info</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-indigo-50 rounded-lg p-3">
            <p className="text-xs text-indigo-500 mb-1">Total Fund</p>
            <p className="font-bold text-indigo-700">{fmt(fundStats?.total_collected)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-green-500 mb-1">Available Balance</p>
            <p className="font-bold text-green-700">{fmt(fundStats?.current_balance)}</p>
          </div>
        </div>
      </div>

      {/* My profile */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">My Profile</h2>
        <div className="space-y-3 text-sm">
          {[
            ['Full Name', member?.full_name],
            ['Phone', member?.phone],
            ['Email', member?.email || '—'],
            ['UPI ID', member?.upi_id || '—'],
            ['Address', member?.address || '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* My loans */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">My Loans</h2>
          <p className="text-xs text-gray-400 mt-0.5">{loans.length} total loans</p>
        </div>
        {loans.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <IndianRupee className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No loans taken yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {loans.map(loan => {
              const interest = calcInterest(loan)
              return (
                <div key={loan.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {statusIcon(loan.status)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(loan.status)}`}>
                        {loan.status}
                      </span>
                    </div>
                    <span className="font-bold text-indigo-700 text-lg">{fmt(loan.amount)}</span>
                  </div>
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                    <p><span className="text-gray-400">Purpose:</span> {loan.purpose}</p>
                    <p className="mt-1"><span className="text-gray-400">Applied:</span> {new Date(loan.applied_date).toLocaleDateString('en-IN') : 'N/A'}</p>
                    {loan.disbursed_date && (
                      <p className="mt-1"><span className="text-gray-400">Disbursed:</span> {new Date(loan.disbursed_date).toLocaleDateString('en-IN') : 'N/A'}</p>
                    )}
                  </div>
                  {loan.status === 'active' && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                      <p className="font-medium text-orange-700 mb-1">Interest Summary</p>
                      <div className="space-y-1 text-xs text-orange-600">
                        <div className="flex justify-between"><span>Months elapsed</span><span>{interest.months}</span></div>
                        <div className="flex justify-between"><span>Current rate</span><span>{interest.rate}% per month</span></div>
                        <div className="flex justify-between font-semibold"><span>Total interest due</span><span>{fmt(interest.due)}</span></div>
                      </div>
                    </div>
                  )}
                  {loan.status === 'rejected' && loan.rejection_reason && (
                    <div className="bg-red-50 rounded-lg p-3 text-xs text-red-600">
                      <span className="font-medium">Rejection reason: </span>{loan.rejection_reason}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-gray-400">Guarantor 1</p>
                      <p className="font-medium">{loan.guarantor1?.full_name || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-gray-400">Guarantor 2</p>
                      <p className="font-medium">{loan.guarantor2?.full_name || '—'}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Payment History</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {payments.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium capitalize">{p.payment_type.replace('_',' ')}</p>
                  <p className="text-xs text-gray-400">{new Date(p.payment_date).toLocaleDateString('en-IN') : 'N/A'} · {p.payment_mode}</p>
                </div>
                <span className="font-semibold text-green-600">{fmt(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
