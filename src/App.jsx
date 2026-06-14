import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import MemberDashboard from './pages/MemberDashboard'
import Members from './pages/Members'
import Loans from './pages/Loans'
import LoanApplication from './pages/LoanApplication'
import Payments from './pages/Payments'
import Layout from './components/Layout'
import MemberLayout from './components/MemberLayout'

function AdminRoute({ children }) {
  const { user, loading, profile } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>
  if (!user) return <Navigate to="/login" />
  if (profile?.role === 'member') return <Navigate to="/member" />
  return children
}

function MemberRoute({ children }) {
  const { user, loading, profile } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>
  if (!user) return <Navigate to="/login" />
  if (profile?.role === 'admin') return <Navigate to="/" />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Admin routes */}
        <Route path="/" element={<AdminRoute><Layout /></AdminRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="members" element={<Members />} />
          <Route path="loans" element={<Loans />} />
          <Route path="loans/apply" element={<LoanApplication />} />
          <Route path="payments" element={<Payments />} />
        </Route>
        {/* Member routes */}
        <Route path="/member" element={<MemberRoute><MemberLayout /></MemberRoute>}>
          <Route index element={<MemberDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
