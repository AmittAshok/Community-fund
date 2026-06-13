import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SignatureCanvas from 'react-signature-canvas'
import toast from 'react-hot-toast'
import { Phone, Building2, RotateCcw } from 'lucide-react'

export default function LoanApplication() {
  const navigate = useNavigate()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const borrowerSigRef = useRef()
  const guarantor1SigRef = useRef()
  const guarantor2SigRef = useRef()
  const [form, setForm] = useState({
    member_id: '', amount: '', purpose: '',
    payment_method: 'upi', upi_number: '',
    bank_account: '', bank_ifsc: '', bank_name: '',
    guarantor1_id: '', guarantor2_id: '',
  })

  useEffect(() => {
    supabase.from('members').select('id,full_name,phone')
      .eq('is_active', true).order('full_name')
      .then(({ data }) => setMembers(data || []))
  }, [])

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const uploadSignature = async (sigRef, label) => {
    if (sigRef.current.isEmpty()) { toast.error(`${label} signature required`); return null }
    const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png')
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0))
    const fileName = `signatures/${Date.now()}_${label}.png`
    const { error } = await supabase.storage.from('loan-documents')
      .upload(fileName, bytes, { contentType: 'image/png' })
    if (error) { toast.error(`Failed to upload ${label} signature`); return null }
    return supabase.storage.from('loan-documents').getPublicUrl(fileName).data.publicUrl
  }

  const handleSubmit = async () => {
    if (!form.member_id || !form.amount || !form.purpose) { toast.error('Fill all required fields'); return }
    if (form.guarantor1_id === form.member_id || form.guarantor2_id === form.member_id) { toast.error('Guarantor cannot be the borrower'); return }
    if (form.guarantor1_id === form.guarantor2_id) { toast.error('Both guarantors cannot be same'); return }
    setLoading(true)
    try {
      const [borrowerUrl, g1Url, g2Url] = await Promise.all([
        uploadSignature(borrowerSigRef, 'borrower'),
        uploadSignature(guarantor1SigRef, 'guarantor1'),
        uploadSignature(guarantor2SigRef, 'guarantor2'),
      ])
      if (!borrowerUrl || !g1Url || !g2Url) { setLoading(false); return }
      const { error } = await supabase.from('loans').insert([{
        member_id: form.member_id, amount: parseFloat(form.amount),
        purpose: form.purpose, payment_method: form.payment_method,
        upi_number: form.upi_number, bank_account: form.bank_account || null,
        bank_ifsc: form.bank_ifsc || null, bank_name: form.bank_name || null,
        guarantor1_id: form.guarantor1_id || null, guarantor2_id: form.guarantor2_id || null,
        borrower_signature_url: borrowerUrl,
        guarantor1_signature_url: g1Url, guarantor2_signature_url: g2Url,
        status: 'pending',
      }])
      if (error) throw error
      toast.success('Loan application submitted!')
      navigate('/loans')
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  const MemberSelect = ({ label, field, exclude = [] }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label} *</label>
      <select value={form[field]} onChange={e => set(field, e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <option value="">Select member</option>
        {members.filter(m => !exclude.includes(m.id)).map(m => (
          <option key={m.id} value={m.id}>{m.full_name} — {m.phone}</option>
        ))}
      </select>
    </div>
  )

  const SigPad = ({ sigRef, label, onClear }) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-gray-700">{label} *</label>
        <button type="button" onClick={onClear} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
          <RotateCcw className="w-3 h-3" /> Clear
        </button>
      </div>
      <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
        <SignatureCanvas ref={sigRef} penColor="#1e1b4b"
          canvasProps={{ width: 500, height: 150, className: 'w-full rounded-lg' }} />
      </div>
      <p className="text-xs text-gray-400 mt-1">Sign inside the box using mouse or touch</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Loan Application</h1>
        <p className="text-gray-500 text-sm">Complete all 3 steps to submit</p>
      </div>
      <div className="flex items-center gap-2">
        {['Loan Details','Payment Method','Signatures'].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${step > i+1 ? 'bg-green-500 text-white' : step === i+1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {step > i+1 ? '✓' : i+1}
            </div>
            <span className={`text-sm hidden md:block ${step === i+1 ? 'text-indigo-600 font-medium' : 'text-gray-400'}`}>{label}</span>
            {i < 2 && <div className={`h-0.5 w-8 md:w-12 ${step > i+1 ? 'bg-green-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        {step === 1 && <>
          <MemberSelect label="Applicant (Borrower)" field="member_id" exclude={[form.guarantor1_id, form.guarantor2_id]} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount (₹) *</label>
            <input type="number" min="1" value={form.amount} onChange={e => set('amount', e.target.value)}
              placeholder="e.g. 10000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose of Loan *</label>
            <textarea rows={3} value={form.purpose} onChange={e => set('purpose', e.target.value)}
              placeholder="Describe why this loan is needed..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MemberSelect label="Guarantor 1" field="guarantor1_id" exclude={[form.member_id, form.guarantor2_id]} />
            <MemberSelect label="Guarantor 2" field="guarantor2_id" exclude={[form.member_id, form.guarantor1_id]} />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            Interest: <strong>2% per month</strong> for first 3 months → <strong>5% per month</strong> from month 4 onwards
          </div>
          <button onClick={() => {
            if (!form.member_id || !form.amount || !form.purpose || !form.guarantor1_id || !form.guarantor2_id)
              { toast.error('Please fill all fields and select both guarantors'); return }
            setStep(2)
          }} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700">
            Next — Payment Method →
          </button>
        </>}

        {step === 2 && <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">How should we transfer the money? *</label>
            <div className="grid grid-cols-2 gap-3">
              {[['upi','UPI / PhonePe / GPay', Phone],['bank','Bank Transfer (NEFT)', Building2]].map(([val, label, Icon]) => (
                <button key={val} type="button" onClick={() => set('payment_method', val)}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors
                    ${form.payment_method === val ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <Icon className="w-5 h-5 text-indigo-600" />
                  <div className="text-left"><p className="font-medium text-sm">{label}</p></div>
                </button>
              ))}
            </div>
          </div>
          {form.payment_method === 'upi' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PhonePe / GPay Number *</label>
              <input type="text" value={form.upi_number} onChange={e => set('upi_number', e.target.value)}
                placeholder="9876543210 or name@upi"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <p className="text-xs text-gray-400 mt-1">Admin will transfer directly to this UPI ID</p>
            </div>
          )}
          {form.payment_method === 'bank' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number *</label>
                <input type="text" value={form.bank_account} onChange={e => set('bank_account', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code *</label>
                  <input type="text" value={form.bank_ifsc} onChange={e => set('bank_ifsc', e.target.value.toUpperCase())}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name *</label>
                  <input type="text" value={form.bank_name} onChange={e => set('bank_name', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm hover:bg-gray-50">← Back</button>
            <button onClick={() => {
              if (form.payment_method === 'upi' && !form.upi_number) { toast.error('Enter UPI number'); return }
              if (form.payment_method === 'bank' && (!form.bank_account || !form.bank_ifsc)) { toast.error('Fill bank details'); return }
              setStep(3)
            }} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700">
              Next — Signatures →
            </button>
          </div>
        </>}

        {step === 3 && <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            All three parties must sign below to confirm this loan agreement.
          </div>
          <SigPad sigRef={borrowerSigRef} label="Borrower Signature" onClear={() => borrowerSigRef.current.clear()} />
          <SigPad sigRef={guarantor1SigRef} label="Guarantor 1 Signature" onClear={() => guarantor1SigRef.current.clear()} />
          <SigPad sigRef={guarantor2SigRef} label="Guarantor 2 Signature" onClear={() => guarantor2SigRef.current.clear()} />
          <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2 border border-gray-100">
            <p className="font-medium text-gray-700">Application Summary</p>
            <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold text-indigo-700">₹{Number(form.amount).toLocaleString('en-IN')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Purpose</span><span className="font-medium">{form.purpose}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Payment via</span><span className="font-medium">{form.payment_method === 'upi' ? `UPI: ${form.upi_number}` : `Bank: ${form.bank_account}`}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Interest</span><span className="font-medium">2%/month (1-3) → 5%/month (4+)</span></div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm hover:bg-gray-50">← Back</button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Submitting...' : '✓ Submit Application'}
            </button>
          </div>
        </>}
      </div>
    </div>
  )
}
