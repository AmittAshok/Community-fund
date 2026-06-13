import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { IndianRupee, Users, FileText, TrendingUp, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{title}</p>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState({ collected: 0, disbursed: 0, balance: 0, interest: 0 })
  const [activeLoans, setActiveLoans] = useState([])
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: fund }, { data: loans }, { count }] = await Promise.all([
        supabase.from('fund_status').select('*').single(),
        supabase.from('active_loans_summary').select('*'),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('is_active', true),
      ])
      if (fund) setStats({
        collected: fund.total_collected || 0,
        disbursed: fund.total_disbursed || 0,
        balance:   fund.current_balance || 0,
        interest:  fund.total_interest_earned || 0,
      })
      if (loans) setActiveLoans(loans)
      setMemberCount(count || 0)
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`

  if (loading) return <div className="text-center text-gray-400 mt-20">Loading dashboard...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">Community Fund Overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Fund Balance"       value={fmt(stats.balance)}   icon={IndianRupee} color="bg-indigo-500" />
        <StatCard title="Total Collected"    value={fmt(stats.collected)} icon={TrendingUp}  color="bg-green-500" />
        <StatCard title="Total Disbursed"    value={fmt(stats.disbursed)} icon={FileText}    color="bg-orange-500" />
        <StatCard title="Active Members"     value={memberCount}          icon={Users}       color="bg-purple-500" />
      </div>

      {/* Active Loans Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Active Loans</h2>
          <span className="text-sm text-gray-500">{activeLoans.length} loans</span>
        </div>
        {activeLoans.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No active loans</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {['Member','Phone','Principal','Outstanding','Rate','Months','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeLoans.map(loan => (
                  <tr key={loan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{loan.full_name}</td>
                    <td className="px-4 py-3 text-gray-500">{loan.phone}</td>
                    <td className="px-4 py-3">{fmt(loan.principal)}</td>
                    <td className="px-4 py-3 font-medium text-orange-600">{fmt(loan.principal_outstanding)}</td>
                    <td className="px-4 py-3">{loan.current_interest_rate}%</td>
                    <td className="px-4 py-3">{loan.months_elapsed}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium
                        ${loan.status === 'active'  ? 'bg-green-100 text-green-700' :
                          loan.status === 'overdue' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'}`}>
                        {loan.status}
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
