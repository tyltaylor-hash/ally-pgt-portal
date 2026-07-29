import { useState, useEffect, createContext, useContext, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useParams } from 'react-router-dom'
import { jsPDF } from 'jspdf'
import { 
  LayoutDashboard, FileText, Building2, Package, Users, LogOut, Plus, 
  Clock, CheckCircle, AlertCircle, Search, ChevronRight, Loader2, Eye, X, Mail,
  BarChart3, Phone, MapPin, Filter, Download, User, Upload, FileUp,
  ClipboardList, Save, Check, Globe, RefreshCw
} from 'lucide-react'
// NOTE: Install with: npm install react-signature-canvas
import SignatureCanvas from 'react-signature-canvas'

// ============================================================================
// ALLY GENETICS LOGO COMPONENT (using actual logo image)
// ============================================================================
function DNAHelixLogo({ size = 32, className = '' }) {
  return (
    <img 
      src="/logo.jpg" 
      alt="Ally Genetics"
      style={{ height: size * 1.8, width: 'auto' }}
      className={className}
    />
  )
}

// ============================================================================
// SUPABASE CLIENT
// ============================================================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY


// HIPAA Compliant Configuration:
// - Auth tokens can persist (they don't contain PHI)
// - Session will timeout after 30 minutes of inactivity
// - All patient data stored server-side only
// - No PHI in localStorage
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true, // Allow session persistence for better UX
    detectSessionInUrl: true,
    // Session expires after 30 minutes of inactivity (HIPAA compliant)
    // Users will need to re-authenticate after this period
  }
})

// ============================================================================
// AUTH CONTEXT
// ============================================================================
const AuthContext = createContext({})

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [impersonating, setImpersonating] = useState(null) // stores impersonated user data
  const [realUserData, setRealUserData] = useState(null) // stores real user when impersonating

  // HIPAA Compliance: Auto-logout after 30 minutes of inactivity
  useEffect(() => {
    let inactivityTimer = null
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds

    function resetInactivityTimer() {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      
      if (user) {
        inactivityTimer = setTimeout(async () => {
          console.warn('Session expired due to inactivity')
          await supabase.auth.signOut()
        }, INACTIVITY_TIMEOUT)
      }
    }

    // Track user activity
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    
    activityEvents.forEach(event => {
      document.addEventListener(event, resetInactivityTimer)
    })

    // Start the timer
    resetInactivityTimer()

    // Cleanup
    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer)
      })
    }
  }, [user])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserData(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserData(session.user.id)
      } else {
        setUserData(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUserData(authId) {
    const { data } = await supabase
      .from('users')
      .select('*, clinic:clinics(id, name)')
      .eq('auth_id', authId)
      .single()
    setUserData(data)
    setRealUserData(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setUserData(null)
    setRealUserData(null)
    setImpersonating(null)
  }

  // Start impersonating a user
  async function startImpersonation(targetUser) {
    // Fetch full user data with clinic
    const { data } = await supabase
      .from('users')
      .select('*, clinic:clinics(id, name)')
      .eq('id', targetUser.id)
      .single()
    
    setImpersonating(data)
    setUserData(data)
  }

  // Stop impersonating
  function stopImpersonation() {
    setImpersonating(null)
    setUserData(realUserData)
  }

  const isAllyStaff = realUserData?.role === 'ally_admin'
  const activeUserData = impersonating || userData

  return (
    <AuthContext.Provider value={{ 
      user, 
      userData: activeUserData, 
      realUserData,
      loading, 
      signIn, 
      signOut, 
      isAllyStaff, 
      supabase,
      impersonating,
      startImpersonation,
      stopImpersonation
    }}>
      {children}
    </AuthContext.Provider>
  )
}

function useAuth() {
  return useContext(AuthContext)
}

// ============================================================================
// PROTECTED ROUTE
// ============================================================================
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, userData, loading, isAllyStaff } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-ally-teal" />
      </div>
    )
  }
  
  if (!user || !userData) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && !isAllyStaff) {
    return <Navigate to="/clinic" replace />
  }

  return children
}

// ============================================================================
// LOGIN PAGE
// ============================================================================
function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const { signIn, user, userData, isAllyStaff, supabase } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && userData) {
      navigate(isAllyStaff ? '/admin' : '/clinic')
    }
  }, [user, userData, isAllyStaff, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password'
    })
    
    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <DNAHelixLogo size={64} />
          </div>
          <h1 className="text-2xl font-bold text-ally-navy">Ally Genetics Portal</h1>
          <p className="text-gray-500 mt-2">
            {showReset ? 'Reset your password' : 'Sign in to your account'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          {showReset ? (
            resetSent ? (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">Check your email</h2>
                <p className="text-gray-600 mb-4">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
                <button
                  onClick={() => { setShowReset(false); setResetSent(false); setEmail(''); }}
                  className="text-ally-teal hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal focus:border-transparent"
                    placeholder="Enter your email address"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-ally-teal text-white py-2 px-4 rounded-md hover:bg-ally-teal-dark transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Send Reset Link
                </button>
                <button
                  type="button"
                  onClick={() => { setShowReset(false); setError(null); }}
                  className="w-full text-gray-600 hover:text-gray-800 text-sm"
                >
                  Back to sign in
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal focus:border-transparent"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-ally-teal text-white py-2 px-4 rounded-md hover:bg-ally-teal-dark transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Sign in
              </button>
              <button
                type="button"
                onClick={() => { setShowReset(true); setError(null); }}
                className="w-full text-gray-600 hover:text-ally-teal text-sm"
              >
                Forgot your password?
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          Need help? Contact <a href="mailto:lab@allygenetics.com" className="text-ally-teal hover:underline">lab@allygenetics.com</a>
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// ADMIN LAYOUT
// ============================================================================
function AdminLayout({ children }) {
  const { userData, signOut } = useAuth()
  const navigate = useNavigate()
  const [showProfile, setShowProfile] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const navigation = [
    { name: 'All Cases', href: '/admin/cases', icon: FileText },
    { name: 'Clinics', href: '/admin/clinics', icon: Building2 },
    { name: 'Kit Orders', href: '/admin/orders', icon: Package },
    { name: 'Bulk Import', href: '/admin/import', icon: Upload },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-ally-navy text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/admin" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-ally-teal rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AG</span>
                </div>
                <span className="font-semibold hidden sm:block">Ally Genetics Admin</span>
              </Link>
              <div className="hidden sm:flex sm:ml-8 sm:space-x-2">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    className="flex items-center px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 rounded-md"
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm hidden sm:block">{userData?.first_name} {userData?.last_name}</span>
              <button 
                onClick={() => setShowProfile(true)} 
                className="p-2 text-gray-300 hover:text-white"
                title="My Profile"
              >
                <User className="w-5 h-5" />
              </button>
              <button onClick={handleSignOut} className="p-2 text-gray-300 hover:text-white" title="Sign Out">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  )
}

// ============================================================================
// CLINIC LAYOUT
// ============================================================================
function ClinicLayout({ children }) {
  const { userData, signOut, impersonating, stopImpersonation } = useAuth()
  const navigate = useNavigate()
  const [showProfile, setShowProfile] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleStopImpersonation = () => {
    stopImpersonation()
    navigate('/admin/clinics')
  }

  const navigation = [
    { name: 'Home', href: '/clinic', icon: LayoutDashboard },
    { name: 'Requisition', href: '/clinic/cases/new', icon: FileText },
    { name: 'Biopsy Worksheet', href: '/clinic/worksheet', icon: ClipboardList },
    { name: 'Cases', href: '/clinic/cases', icon: FileText },
    { name: 'Order Supplies', href: '/clinic/orders', icon: Package },
    { name: 'Lab Statistics', href: '/clinic/stats', icon: BarChart3 },
    { name: 'Contact Us', href: '/clinic/contact', icon: Phone },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Impersonation Banner */}
      {impersonating && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white px-4 py-2 z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span className="text-sm font-medium">
                Viewing as: {impersonating.first_name} {impersonating.last_name} ({impersonating.clinic?.name || 'No clinic'})
              </span>
            </div>
            <button
              onClick={handleStopImpersonation}
              className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm"
            >
              <X className="w-4 h-4" />
              Exit View
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-60'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${impersonating ? 'mt-10' : ''}`}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center gap-3 px-4 border-b border-gray-200">
          <img 
            src="/logo-icon.png" 
            alt="Ally Genetics" 
            className="w-10 h-10 flex-shrink-0 object-contain"
          />
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-[#2D2A4A] text-sm leading-tight">Ally Genetics</span>
              <span className="text-[10px] text-gray-500 leading-tight">Better Partnerships, Better Results</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 hover:text-ally-teal hover:border-l-3 hover:border-ally-teal transition-colors ${
                window.location.pathname === item.href ? 'bg-ally-teal/10 text-ally-teal border-l-3 border-ally-teal font-medium' : 'border-l-3 border-transparent'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.name}</span>}
            </Link>
          ))}
        </nav>

        {/* User Menu */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{background: 'linear-gradient(135deg, #7ECFC0 0%, #A8E0D7 100%)'}}>
              <span className="text-white font-semibold text-xs">
                {userData?.first_name?.[0]}{userData?.last_name?.[0]}
              </span>
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {userData?.first_name} {userData?.last_name}
                </div>
                <div className="text-xs text-gray-500 truncate">{userData?.clinic?.name}</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className={`h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 ${impersonating ? 'mt-10' : ''}`}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-ally-navy">
              {navigation.find(item => item.href === window.location.pathname)?.name || 'Home'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {!impersonating && (
              <>
                <button 
                  onClick={() => setShowProfile(true)} 
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="My Profile"
                >
                  <User className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleSignOut} 
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" 
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  )
}

// ============================================================================
// STATUS HELPERS
// ============================================================================
const statusLabels = {
  consent_pending: 'Consent Pending',
  consent_complete: 'Consent Complete',
  samples_received: 'Samples Received',
  in_progress: 'In Progress',
  report_ready: 'Report Ready',
  complete: 'Complete',
  cancelled: 'Cancelled',
}

const statusColors = {
  consent_pending: 'bg-yellow-100 text-yellow-800',
  consent_complete: 'bg-blue-100 text-blue-800',
  samples_received: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  report_ready: 'bg-green-100 text-green-800',
  complete: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
      {statusLabels[status] || status}
    </span>
  )
}

// ============================================================================
// ADMIN DASHBOARD
// ============================================================================
function AdminDashboard() {
  const { supabase } = useAuth()
  const [cases, setCases] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [uploadingCase, setUploadingCase] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const { data: allCases } = await supabase
      .from('cases')
      .select('*, clinic:clinics(id, name), ordering_provider:providers(first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(15)

    const { data: statusData } = await supabase.from('cases').select('status, report_file_url')
    
    const statusCounts = {
      total: statusData?.length || 0,
      consent_pending: statusData?.filter(c => c.status === 'consent_pending').length || 0,
      report_ready: statusData?.filter(c => c.status === 'report_ready').length || 0,
      reports_filled: statusData?.filter(c => c.report_file_url).length || 0,
    }

    setCases(allCases || [])
    setCounts(statusCounts)
    setLoading(false)
  }

  async function handleUploadReport(caseData, file) {
    setUploadingCase(caseData.id)
    
    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${caseData.case_number}_report_${Date.now()}.${fileExt}`
      const filePath = `reports/${caseData.clinic_id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('case-documents')
        .getPublicUrl(filePath)

      // Update case with report URL and status
      const { error: updateError } = await supabase
        .from('cases')
        .update({
          report_file_url: urlData.publicUrl,
          report_file_name: file.name,
          report_uploaded_at: new Date().toISOString(),
          status: 'report_ready'
        })
        .eq('id', caseData.id)

      if (updateError) throw updateError

      alert('Report uploaded successfully! Clinic will be notified once consents are signed.')
      fetchData()
    } catch (err) {
      console.error('Upload error:', err)
      alert('Error uploading report: ' + err.message)
    }
    
    setUploadingCase(null)
  }

  const statCards = [
    { label: 'Requisitions Submitted', value: counts.total || 0, icon: FileText, color: 'bg-gray-100 text-gray-600' },
    { label: 'Reports Filled', value: counts.reports_filled || 0, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
    { label: 'Consent Pending', value: counts.consent_pending || 0, icon: Clock, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Reports Ready', value: counts.report_ready || 0, icon: FileText, color: 'bg-blue-50 text-blue-600' },
  ]

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-ally-teal" /></div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500">Overview of all clinic activity</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white rounded-lg border p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Cases</h2>
          <Link to="/admin/cases" className="text-ally-teal hover:underline text-sm">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Case #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clinic</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Report</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cases.length > 0 ? cases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-ally-teal">
                    {c.case_number || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{c.patient_last_name}, {c.patient_first_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {c.clinic?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {c.report_file_url ? (
                      <a 
                        href={c.report_file_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-green-600 hover:underline text-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        View
                      </a>
                    ) : (
                      <label className="inline-flex items-center gap-1 text-ally-teal hover:underline text-sm cursor-pointer">
                        {uploadingCase === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Upload
                          </>
                        )}
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleUploadReport(c, e.target.files[0])
                            }
                          }}
                          disabled={uploadingCase === c.id}
                        />
                      </label>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">No cases yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// CLINIC DASHBOARD
// ============================================================================
function ClinicDashboard() {
  const { supabase, userData } = useAuth()
  const navigate = useNavigate()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [showSuppliesModal, setShowSuppliesModal] = useState(false)
  const [sortField, setSortField] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')

  useEffect(() => {
    if (userData?.clinic_id) {
      fetchPatients()
    } else if (userData) {
      setLoading(false)
    }
  }, [userData])

  async function fetchPatients() {
    // Fetch all cases for this clinic with ordering provider info, clinic info, and consents
    const { data: allCases } = await supabase
      .from('cases')
      .select(`
        *,
        clinic:clinics(id, name, address, city, state, zip, phone, email),
        ordering_provider:providers(first_name, last_name, credentials),
        consents(id, signer_type, status, signed_at, consent_token)
      `)
      .eq('clinic_id', userData.clinic_id)
      .order('created_at', { ascending: false })

    if (!allCases) {
      setPatients([])
      setLoading(false)
      return
    }

    // Group cases by patient (patient_first_name + patient_last_name + patient_dob)
    const patientMap = {}
    allCases.forEach(c => {
      const key = `${c.patient_first_name}_${c.patient_last_name}_${c.patient_dob}`
      if (!patientMap[key]) {
        patientMap[key] = {
          first_name: c.patient_first_name,
          last_name: c.patient_last_name,
          dob: c.patient_dob,
          doctor: c.ordering_provider 
            ? `${c.ordering_provider.first_name} ${c.ordering_provider.last_name}${c.ordering_provider.credentials ? ', ' + c.ordering_provider.credentials : ''}`
            : 'N/A',
          cycles: []
        }
      }
      // Add consent info to cycle
      const patientConsent = c.consents?.find(con => con.signer_type === 'patient')
      const partnerConsent = c.consents?.find(con => con.signer_type === 'partner')
      patientMap[key].cycles.push({
        ...c,
        patientConsent,
        partnerConsent
      })
    })

    setPatients(Object.values(patientMap))
    setLoading(false)
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Flatten patients into individual case rows
  const allCaseRows = patients.flatMap(p =>
    p.cycles.map(c => ({
      ...c,
      patientName: `${p.last_name}, ${p.first_name}`,
      dob: p.dob,
      doctor: p.doctor,
      patient: p,
    }))
  )

  const filteredPatients = allCaseRows
    .filter(c => {
      if (!searchTerm) return true
      const search = searchTerm.toLowerCase()
      return (
        c.patientName?.toLowerCase().includes(search) ||
        c.dob?.includes(search) ||
        c.case_number?.toLowerCase().includes(search)
      )
    })
    .sort((a, b) => {
      // Report ready + consent signed + not viewed = top (new reports)
      // Report ready + consent not signed = next (awaiting consent)
      // Everything else sorted normally
      const aReport = a.report_file_url && a.patientConsent?.status === 'signed' && (!a.requires_partner_consent || a.partnerConsent?.status === 'signed') && !a.report_viewed_at ? 2
        : a.report_file_url && !(a.patientConsent?.status === 'signed' && (!a.requires_partner_consent || a.partnerConsent?.status === 'signed')) ? 1
        : 0
      const bReport = b.report_file_url && b.patientConsent?.status === 'signed' && (!b.requires_partner_consent || b.partnerConsent?.status === 'signed') && !b.report_viewed_at ? 2
        : b.report_file_url && !(b.patientConsent?.status === 'signed' && (!b.requires_partner_consent || b.partnerConsent?.status === 'signed')) ? 1
        : 0
      if (aReport !== bReport) return bReport - aReport

      let aVal, bVal
      if (sortField === 'name') {
        aVal = a.patientName?.toLowerCase() || ''
        bVal = b.patientName?.toLowerCase() || ''
      } else if (sortField === 'dob') {
        aVal = a.dob || ''
        bVal = b.dob || ''
      } else if (sortField === 'doctor') {
        aVal = (a.doctor || '').toLowerCase()
        bVal = (b.doctor || '').toLowerCase()
      } else if (sortField === 'case') {
        aVal = a.case_number || ''
        bVal = b.case_number || ''
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-ally-teal" /></div>
  }

  if (!userData?.clinic_id) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Clinic Assigned</h2>
        <p className="text-gray-500">Your account is not associated with a clinic.</p>
      </div>
    )
  }

  return (
    <>
      {/* Quick Action Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => navigate('/clinic/cases/new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-ally-teal text-white rounded-lg hover:bg-ally-teal-dark transition-all hover:shadow-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Requisition
        </button>
        <button
          onClick={() => navigate('/clinic/worksheet')}
          className="flex items-center gap-2 px-4 py-2.5 bg-ally-teal text-white rounded-lg hover:bg-ally-teal-dark transition-all hover:shadow-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Biopsy Worksheet
        </button>
        <button
          onClick={() => setShowSuppliesModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-ally-teal text-white rounded-lg hover:bg-ally-teal-dark transition-all hover:shadow-lg text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Order Supplies
        </button>
      </div>

      {/* Patient Records Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-visible">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
          <h2 className="text-base font-semibold text-ally-navy whitespace-nowrap">Cases</h2>
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search patient, case #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ally-teal w-full text-xs"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  onClick={() => handleSort('case')}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-52"
                >Case #</th>
                <th 
                  onClick={() => handleSort('name')}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >Patient</th>
                <th 
                  onClick={() => handleSort('dob')}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 w-24"
                >DOB</th>
                <th 
                  onClick={() => handleSort('doctor')}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >Doctor</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Consent</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPatients.length > 0 ? filteredPatients.map((c, idx) => {
                const consentSigned = c.patientConsent?.status === 'signed' && (!c.requires_partner_consent || c.partnerConsent?.status === 'signed')
                const consentPending = !consentSigned && (c.patientConsent || c.partnerConsent)
                const hasReport = !!c.report_file_url
                const reportReleasable = hasReport && consentSigned
                const reportLocked = hasReport && !consentSigned
                const isNew = reportReleasable && !c.report_viewed_at

                async function handleReportClick(e) {
                  e.stopPropagation()
                  if (!reportReleasable) return
                  if (!c.report_viewed_at) {
                    await supabase.from('cases').update({ report_viewed_at: new Date().toISOString() }).eq('id', c.id)
                    c.report_viewed_at = new Date().toISOString()
                    fetchPatients()
                  }
                  window.open(c.report_file_url, '_blank')
                }

                return (
                  <tr 
                    key={c.id || idx}
                    onClick={() => setSelectedPatient(c.patient)}
                    className={`cursor-pointer transition-colors text-sm ${isNew ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-3 py-2.5">
                      <span className={`font-medium ${isNew ? 'text-green-700' : 'text-ally-teal'}`}>
                        {c.case_number}
                      </span>
                      {isNew && <span className="ml-1.5 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">New</span>}
                      {reportLocked && <span className="ml-1.5 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">Awaiting Consent</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-900 font-medium">{c.patientName}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{c.dob ? new Date(c.dob + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{c.doctor}</td>
                    <td className="px-3 py-2.5 text-center">
                      {consentSigned ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
                          <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </span>
                      ) : consentPending ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100">
                          <svg className="w-3 h-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100">
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {reportReleasable ? (
                        <button onClick={handleReportClick}
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 hover:bg-green-200 transition-colors">
                          <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        </button>
                      ) : reportLocked ? (
                        <span className="group relative inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100 cursor-not-allowed">
                          <svg className="w-3 h-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 00-3 3v4H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V10a2 2 0 00-2-2h-2V4a3 3 0 00-3-3z" /></svg>
                          <div className="absolute top-6 right-0 w-44 bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center">
                            Report is ready but locked until consents are completed. Once signed, the report will be released.
                          </div>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100">
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    {searchTerm ? (
                      <p className="text-sm">No cases found matching "{searchTerm}"</p>
                    ) : (
                      <div>
                        <p className="text-sm mb-1">No cases yet.</p>
                        <button 
                          onClick={() => navigate('/clinic/cases/new')}
                          className="text-ally-teal hover:underline text-sm"
                        >
                          Submit your first requisition →
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Cycles Modal */}
      {selectedPatient && (
        <PatientCyclesModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
          supabase={supabase}
        />
      )}


      {/* Order Supplies Modal */}
      {showSuppliesModal && (
        <OrderSuppliesModal onClose={() => setShowSuppliesModal(false)} />
      )}
    </>
  )
}

// ============================================================================
// PATIENT CYCLES MODAL
// ============================================================================

// ============================================================================
// SHARED PDF GENERATION FUNCTIONS
// ============================================================================

function generateBiopsyWorksheetPDF(cycle) {
  const doc = new jsPDF({ orientation: 'portrait' })
  const pageWidth = doc.internal.pageSize.getWidth()  // ~210mm
  const pageHeight = doc.internal.pageSize.getHeight() // ~297mm
  const margin = 10
  const contentWidth = pageWidth - (margin * 2)
  let y = margin

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) }
    catch { return dateStr }
  }

  const navyBlue = [30, 58, 95]
  const teal = [13, 148, 136]
  const lightGray = [245, 247, 250]
  const headerGray = [220, 226, 235]

  // ===== HEADER STRIPE =====
  doc.setFillColor(...navyBlue)
  doc.rect(0, 0, pageWidth, 2.5, 'F')

  y = 9
  doc.setTextColor(...navyBlue)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('Ally Genetics', margin, y)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...teal)
  doc.text('Better Partnerships. Better Results.', margin, y + 4)

  doc.setTextColor(...navyBlue)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('PGT Biopsy Worksheet', pageWidth / 2, y + 1, { align: 'center' })

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text('1001 Parchment Dr SE, Grand Rapids, MI 49546', pageWidth - margin, y - 2, { align: 'right' })
  doc.text('Phone: (616) 465-2400  |  lab@allygenetics.com', pageWidth - margin, y + 2, { align: 'right' })

  y = 20

  // ===== TOP INFO SECTION (3 columns) =====
  const col = contentWidth / 3
  const rowH = 7
  const fieldColor = [250, 250, 252]

  const drawInfoBox = (x, boxY, w, label, value) => {
    doc.setFillColor(...fieldColor)
    doc.setDrawColor(180, 190, 205)
    doc.roundedRect(x, boxY, w - 2, rowH, 1, 1, 'FD')
    doc.setFontSize(6)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 110, 125)
    doc.text(label.toUpperCase(), x + 2, boxY + 2.5)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(20, 20, 20)
    doc.text(value || '', x + 2, boxY + 5.8)
  }

  // Row 1: Patient | Clinic | PGT Type
  const patientName = `${cycle.patient_last_name || ''}, ${cycle.patient_first_name || ''}`.trim().replace(/^,\s*/, '')
  const partnerName = cycle.partner_first_name
    ? `${cycle.partner_last_name || ''}, ${cycle.partner_first_name || ''}`.trim().replace(/^,\s*/, '')
    : '—'
  const clinicName = cycle.clinic?.name || ''
  const providerName = cycle.ordering_provider
    ? `${cycle.ordering_provider.first_name || ''} ${cycle.ordering_provider.last_name || ''}${cycle.ordering_provider.credentials ? ', ' + cycle.ordering_provider.credentials : ''}`.trim()
    : ''
  const pgtType = cycle.tests_ordered?.map(t => t.replace('pgt_', 'PGT-').toUpperCase()).join(', ') || ''

  drawInfoBox(margin, y, col, 'Patient Name (Last, First)', patientName)
  drawInfoBox(margin + col, y, col, 'Clinic Name', clinicName)
  drawInfoBox(margin + col * 2, y, col, 'PGT Test Type', pgtType)

  y += rowH + 2

  // Row 2: DOB | Provider | Donor info
  const donorInfo = [
    cycle.is_egg_donor ? `Egg Donor${cycle.egg_donor_age ? ' (Age: ' + cycle.egg_donor_age + ')' : ''}` : null,
    cycle.is_sperm_donor ? `Sperm Donor${cycle.sperm_donor_age ? ' (Age: ' + cycle.sperm_donor_age + ')' : ''}` : null,
  ].filter(Boolean).join('  |  ') || 'No donor gametes'

  drawInfoBox(margin, y, col, 'Patient DOB', formatDate(cycle.patient_dob))
  drawInfoBox(margin + col, y, col, 'Ordering Provider', providerName)
  drawInfoBox(margin + col * 2, y, col, 'Donor Gametes', donorInfo)

  y += rowH + 3

  // Row 3: Partner Name | Partner DOB | Biopsy Date(s)
  drawInfoBox(margin, y, col, 'Partner Name (Last, First)', partnerName)
  drawInfoBox(margin + col, y, col, 'Partner DOB', cycle.partner_dob ? formatDate(cycle.partner_dob) : '—')
  drawInfoBox(margin + col * 2, y, col, 'Biopsy Date(s)', '')

  y += rowH + 3

  // Row 4: checkboxes (right column only)
  const cbX = margin + col * 2
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(180, 190, 205)
  doc.roundedRect(cbX, y, col - 2, rowH, 1, 1, 'FD')
  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 110, 125)
  doc.text('OPTIONS', cbX + 2, y + 2.5)

  const drawCheckbox = (cx, cy) => {
    doc.setDrawColor(80, 80, 80)
    doc.setLineWidth(0.3)
    doc.setFillColor(255, 255, 255)
    doc.rect(cx, cy, 3, 3, 'FD')
  }
  drawCheckbox(cbX + 2, y + 3.5)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(20, 20, 20)
  doc.text('Rebiopsies included', cbX + 6.5, y + 6)
  drawCheckbox(cbX + 35, y + 3.5)
  doc.text('Additional pages', cbX + 39.5, y + 6)

  y += rowH + 7

  // Rebiopsy note
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  doc.text('Note: If a rebiopsy of a previously tested embryo is included, please specify the original collection tube code (e.g., rebiopsy of AABCE) in the comments column.', margin, y)
  y += 8

  // ===== EMBRYO TABLE =====
  const headers = [
    { label: 'Collection\nTube Code', w: 28 },
    { label: 'IVF Lab\nNumber', w: 18 },
    { label: 'Embryo\nGrade', w: 18 },
    { label: 'Biopsy\nDay', w: 15 },
    { label: 'Biopsy\nEmbryologist\nInitials', w: 22 },
    { label: 'Tube Loading\nEmbryologist\nInitials', w: 22 },
    { label: 'Cells\nVisualized\nIn Tube', w: 18 },
    { label: 'Comments', w: contentWidth - 28 - 18 - 18 - 15 - 22 - 22 - 18 },
  ]

  const tableX = margin
  const headerH = 10
  const rowHeight = 8
  const numRows = 15

  // Header row
  doc.setFillColor(...navyBlue)
  doc.rect(tableX, y, contentWidth, headerH, 'F')

  let colX = tableX
  headers.forEach(h => {
    doc.setFontSize(6)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    const lines = h.label.split('\n')
    const lineH = 2.8
    const startY = y + headerH / 2 - (lines.length * lineH) / 2 + lineH * 0.6
    lines.forEach((line, i) => {
      doc.text(line, colX + h.w / 2, startY + i * lineH, { align: 'center' })
    })
    // Vertical divider
    if (colX > tableX) {
      doc.setDrawColor(255, 255, 255)
      doc.setLineWidth(0.2)
      doc.line(colX, y, colX, y + headerH)
    }
    colX += h.w
  })

  y += headerH

  // Data rows
  for (let row = 0; row < numRows; row++) {
    const rowBg = row % 2 === 0 ? [255, 255, 255] : [245, 247, 250]
    doc.setFillColor(...rowBg)
    doc.rect(tableX, y, contentWidth, rowHeight, 'F')

    // Row border
    doc.setDrawColor(200, 210, 220)
    doc.setLineWidth(0.2)
    doc.line(tableX, y + rowHeight, tableX + contentWidth, y + rowHeight)

    // "Place Sticker Here" in first col, centered
    colX = tableX
    doc.setFontSize(6)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(160, 160, 160)
    doc.text('Place Sticker Here', colX + headers[0].w / 2, y + rowHeight / 2 + 1, { align: 'center' })

    // "Y / N" in Cells Visualized column
    let vizX = tableX
    headers.slice(0, 6).forEach(h => { vizX += h.w })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text('Y / N', vizX + headers[6].w / 2, y + rowHeight / 2 + 1, { align: 'center' })

    // Column dividers
    colX = tableX
    headers.forEach((h, i) => {
      if (i > 0) {
        doc.setDrawColor(200, 210, 220)
        doc.setLineWidth(0.2)
        doc.line(colX, y, colX, y + rowHeight)
      }
      colX += h.w
    })

    // Outer border
    doc.setDrawColor(180, 190, 205)
    doc.rect(tableX, y, contentWidth, rowHeight, 'S')

    y += rowHeight
  }

  y += 8

  // Buffer Lot line
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 30, 30)
  doc.text('Buffer Lot: ___________________________', margin, y)
  y += 10

  // ===== LAB USE ONLY BOX =====
  const labBoxH = 20
  doc.setFillColor(240, 244, 248)
  doc.setDrawColor(...navyBlue)
  doc.setLineWidth(0.5)
  doc.roundedRect(margin, y, contentWidth, labBoxH, 2, 2, 'FD')

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navyBlue)
  doc.text('FOR ALLY GENETICS LAB USE ONLY:', margin + 3, y + 5)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(30, 30, 30)
  const labLine1 = `Date received: ____________________   Sample count: ____________   Initials: ____________`
  const labLine2 = `Date amplified: ____________________   Initials: ____________`
  const labLine3 = `Consent received:  Y / N     Invoice paid:  Y / N     Date Reported: ____________________`
  doc.text(labLine1, margin + 3, y + 10)
  doc.text(labLine2, margin + 3, y + 14)
  doc.text(labLine3, margin + 3, y + 18)

  doc.save(`BiopsyWorksheet_${cycle.patient_last_name || 'Unknown'}_${cycle.patient_first_name || ''}.pdf`)
}

function generateRequisitionPDF(cycle, currentUser = null) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - (margin * 2)
  let y = margin
  
  // Helper function to format date
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    } catch {
      return dateStr
    }
  }
  
  // Helper to capitalize sex
  const formatSex = (sex) => {
    if (!sex) return ''
    return sex.charAt(0).toUpperCase() + sex.slice(1)
  }
  
  // State abbreviation helper
  const getStateAbbrev = (state) => {
    if (!state) return ''
    if (state.length === 2) return state.toUpperCase()
    const states = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
      'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
      'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
      'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
      'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
      'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
      'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
      'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
    }
    return states[state.toLowerCase()] || state
  }
  
  // Colors
  const navyBlue = [30, 58, 95]
  const teal = [13, 148, 136]
  const lightBg = [240, 244, 248]
  const warningYellow = [254, 243, 199]
  const warningBorder = [180, 83, 9]
  
  // ===== HEADER =====
  doc.setFillColor(...navyBlue)
  doc.rect(0, 0, pageWidth, 2.5, 'F')
  
  y = 10
  // Left - Company name
  doc.setTextColor(...navyBlue)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Ally Genetics', margin, y)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(...teal)
  doc.text('Better Partnerships. Better Results.', margin, y + 4)
  
  // Center - Form title
  doc.setTextColor(...navyBlue)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('PGT Test Requisition Form', pageWidth / 2, y + 2, { align: 'center' })
  
  // Right - Contact info
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navyBlue)
  doc.text('Ally Genetics Laboratory', pageWidth - margin, y - 4, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text('1001 Parchment Dr SE', pageWidth - margin, y - 0.5, { align: 'right' })
  doc.text('Grand Rapids, MI 49546', pageWidth - margin, y + 2.5, { align: 'right' })
  doc.text('Phone: (616) 465-2400', pageWidth - margin, y + 5.5, { align: 'right' })
  doc.text('Email: lab@allygenetics.com', pageWidth - margin, y + 8.5, { align: 'right' })
  
  y = 22
  doc.setFillColor(...navyBlue)
  doc.rect(0, y, pageWidth, 0.8, 'F')
  
  // ===== NOTICE BAR =====
  y += 4
  doc.setFillColor(...lightBg)
  doc.roundedRect(margin, y, contentWidth, 7, 1, 1, 'F')
  doc.setDrawColor(...navyBlue)
  doc.roundedRect(margin, y, contentWidth, 7, 1, 1, 'S')
  doc.setTextColor(...navyBlue)
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'bold')
  doc.text('PLEASE COMPLETE ALL SECTIONS • INCOMPLETE FORMS MAY DELAY PROCESSING', pageWidth / 2, y + 4.5, { align: 'center' })
  
  // ===== SECTION HELPER =====
  const drawSectionHeader = (title, startY) => {
    doc.setFillColor(...navyBlue)
    doc.rect(margin, startY, contentWidth, 6, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 3, startY + 4.2)
    return startY + 6
  }
  
  const drawFieldRow = (fields, fieldY, startX = margin + 3) => {
    let x = startX
    doc.setFontSize(6)
    fields.forEach(field => {
      // Label
      doc.setTextColor(100, 100, 100)
      doc.setFont('helvetica', 'normal')
      doc.text(field.label, x, fieldY)
      // Value
      doc.setTextColor(...navyBlue)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      const valueY = fieldY + 4
      doc.text(field.value || '', x, valueY)
      // Underline
      doc.setDrawColor(60, 60, 60)
      doc.line(x, valueY + 1, x + field.width - 5, valueY + 1)
      doc.setFontSize(6)
      x += field.width
    })
    return fieldY + 9
  }
  
  const drawCheckbox = (x, checkY, checked, label) => {
    doc.setDrawColor(60, 60, 60)
    doc.setLineWidth(0.3)
    doc.rect(x, checkY - 2.5, 3.5, 3.5, 'S')
    if (checked) {
      doc.setFillColor(...teal)
      doc.rect(x + 0.5, checkY - 2, 2.5, 2.5, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(6)
      doc.text('✓', x + 0.8, checkY + 0.3)
    }
    doc.setTextColor(40, 40, 40)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(label, x + 5, checkY)
    doc.setLineWidth(0.2)
  }
  
  // ===== PATIENT INFORMATION =====
  y += 10
  y = drawSectionHeader('PATIENT INFORMATION', y)
  
  // Section border
  const patientSectionStart = y
  y += 3
  
  // Row 1: Names and DOB
  y = drawFieldRow([
    { label: 'FIRST NAME', value: cycle.patient_first_name || '', width: 45 },
    { label: 'LAST NAME', value: cycle.patient_last_name || '', width: 45 },
    { label: 'DATE OF BIRTH', value: formatDate(cycle.patient_dob), width: 35 },
    { label: 'SEX', value: formatSex(cycle.patient_sex), width: 25 }
  ], y)
  
  // Row 2: Address
  y = drawFieldRow([
    { label: 'ADDRESS', value: cycle.patient_address || '', width: 80 },
    { label: 'CITY', value: cycle.patient_city || '', width: 40 },
    { label: 'STATE', value: getStateAbbrev(cycle.patient_state), width: 15 },
    { label: 'ZIP', value: cycle.patient_zip || '', width: 20 }
  ], y)
  
  // Row 3: Contact
  y = drawFieldRow([
    { label: 'PHONE', value: cycle.patient_phone || '', width: 50 },
    { label: 'EMAIL', value: cycle.patient_email || '', width: 100 }
  ], y)
  
  // Draw section border
  doc.setDrawColor(200, 200, 200)
  doc.rect(margin, patientSectionStart, contentWidth, y - patientSectionStart + 1, 'S')
  
  // ===== PARTNER INFORMATION =====
  y += 4
  y = drawSectionHeader('PARTNER INFORMATION', y)
  const partnerSectionStart = y
  y += 3
  
  if (cycle.partner_first_name || cycle.no_partner === false) {
    y = drawFieldRow([
      { label: 'FIRST NAME', value: cycle.partner_first_name || '', width: 45 },
      { label: 'LAST NAME', value: cycle.partner_last_name || '', width: 45 },
      { label: 'DATE OF BIRTH', value: formatDate(cycle.partner_dob), width: 35 },
      { label: 'SEX', value: formatSex(cycle.partner_sex), width: 25 }
    ], y)
    
    y = drawFieldRow([
      { label: 'PHONE', value: cycle.partner_phone || '', width: 50 },
      { label: 'EMAIL', value: cycle.partner_email || '', width: 100 }
    ], y)
  } else {
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('No partner / Single parent', margin + 5, y + 3)
    y += 8
  }
  
  doc.setDrawColor(200, 200, 200)
  doc.rect(margin, partnerSectionStart, contentWidth, y - partnerSectionStart + 1, 'S')
  
  // ===== IVF CENTER INFORMATION =====
  y += 4
  y = drawSectionHeader('IVF CENTER / CLINIC INFORMATION', y)
  const clinicSectionStart = y
  y += 3
  
  const clinicName = cycle.clinic?.name || ''
  const clinicPhone = cycle.clinic?.phone || ''
  const clinicAddress = cycle.clinic?.address || ''
  const clinicCity = cycle.clinic?.city || ''
  const clinicState = getStateAbbrev(cycle.clinic?.state)
  const clinicZip = cycle.clinic?.zip || ''
  
  y = drawFieldRow([
    { label: 'CLINIC NAME', value: clinicName, width: 100 },
    { label: 'PHONE', value: clinicPhone, width: 50 }
  ], y)
  
  y = drawFieldRow([
    { label: 'ADDRESS', value: clinicAddress, width: 80 },
    { label: 'CITY', value: clinicCity, width: 40 },
    { label: 'STATE', value: clinicState, width: 15 },
    { label: 'ZIP', value: clinicZip, width: 20 }
  ], y)
  
  // Ordering Physician
  const providerName = cycle.ordering_provider 
    ? `${cycle.ordering_provider.first_name || ''} ${cycle.ordering_provider.last_name || ''}${cycle.ordering_provider.credentials ? ', ' + cycle.ordering_provider.credentials : ''}`
    : ''
  
  y = drawFieldRow([
    { label: 'ORDERING PHYSICIAN', value: providerName, width: 70 },
    { label: 'NPI', value: cycle.ordering_provider?.npi || '', width: 40 },
    { label: 'PHYSICIAN EMAIL', value: cycle.ordering_provider?.email || '', width: 50 }
  ], y)
  
  doc.setDrawColor(200, 200, 200)
  doc.rect(margin, clinicSectionStart, contentWidth, y - clinicSectionStart + 1, 'S')
  
  // ===== TEST INFORMATION =====
  y += 4
  y = drawSectionHeader('TEST INFORMATION', y)
  const testSectionStart = y
  y += 4
  
  // Tests Ordered
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.text('TESTS ORDERED', margin + 3, y)
  y += 4
  
  const testsOrdered = cycle.tests_ordered || []
  drawCheckbox(margin + 3, y, testsOrdered.includes('pgt_a'), 'PGT-A (Aneuploidy Screening)')
  drawCheckbox(margin + 125, y, testsOrdered.includes('pgt_sr'), 'PGT-SR (Structural Rearrangement)')
  
  y += 7
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(6)
  doc.text('REPORTING OPTIONS', margin + 3, y)
  y += 4
  
  drawCheckbox(margin + 3, y, cycle.mask_sex_results === true, 'Mask Sex Results (Do not report embryo sex)')
  
  y += 4
  doc.setDrawColor(200, 200, 200)
  doc.rect(margin, testSectionStart, contentWidth, y - testSectionStart + 1, 'S')
  
  // ===== CYCLE INFORMATION =====
  y += 4
  y = drawSectionHeader('CYCLE INFORMATION', y)
  const cycleSectionStart = y
  y += 3
  
  // Diagnosis - use indication with human-readable label
  const indicationLabels = {
    advanced_maternal_age: 'Advanced maternal age (≥35)',
    recurrent_pregnancy_loss: 'Recurrent pregnancy loss',
    previous_failed_ivf: 'Previous failed IVF cycles',
    male_factor: 'Male factor infertility',
    unexplained_infertility: 'Unexplained infertility',
    previous_aneuploid_conception: 'Previous aneuploid conception',
    repetitive_implantation_failure: 'Repetitive implantation failure',
    elective_pgt_a: 'Elective PGT-A',
    pgt_sr: 'PGT-SR (Structural Rearrangement)',
    other: 'Other'
  }
  const diagnosisValue = cycle.indication
    ? (indicationLabels[cycle.indication] || cycle.indication)
    : (cycle.reason_for_testing || '')
  y = drawFieldRow([
    { label: 'DIAGNOSIS / INDICATION FOR TESTING', value: diagnosisValue, width: 155 }
  ], y)
  
  // Male Factor
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(6)
  doc.text('MALE FACTOR INFERTILITY', margin + 3, y)
  y += 4
  drawCheckbox(margin + 3, y, cycle.male_factor_infertility === true, 'Yes')
  drawCheckbox(margin + 25, y, cycle.male_factor_infertility === false, 'No')
  
  // Donor Gametes
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(6)
  doc.text('DONOR GAMETES USED', margin + 70, y - 4)
  drawCheckbox(margin + 70, y, cycle.is_egg_donor === true, 'Egg Donor')
  drawCheckbox(margin + 105, y, cycle.is_sperm_donor === true, 'Sperm Donor')
  drawCheckbox(margin + 145, y, !cycle.is_egg_donor && !cycle.is_sperm_donor, 'None')
  
  y += 4
  doc.setDrawColor(200, 200, 200)
  doc.rect(margin, cycleSectionStart, contentWidth, y - cycleSectionStart + 1, 'S')
  
  // ===== SIGNATURES =====
  y += 4
  y = drawSectionHeader('SIGNATURES & CONSENT', y)
  const sigSectionStart = y
  y += 5
  
  const halfWidth = contentWidth / 2 - 5
  const submittedDateTime = cycle.created_at ? new Date(cycle.created_at).toLocaleString() : ''

  // Left box - Ordering Physician
  doc.setDrawColor(200, 200, 200)
  doc.rect(margin + 2, y, halfWidth, 30, 'S')
  doc.setTextColor(...navyBlue)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('ORDERING PHYSICIAN', margin + 5, y + 4)

  doc.setTextColor(...navyBlue)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(providerName, margin + 5, y + 10)

  doc.setDrawColor(60, 60, 60)
  doc.line(margin + 5, y + 14, margin + halfWidth - 5, y + 14)
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.text('Signature', margin + 5, y + 17)

  doc.setFillColor(232, 245, 243)
  doc.roundedRect(margin + 5, y + 19, 35, 4.5, 0.5, 0.5, 'F')
  doc.setDrawColor(...teal)
  doc.roundedRect(margin + 5, y + 19, 35, 4.5, 0.5, 0.5, 'S')
  doc.setTextColor(...teal)
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  doc.text('✓ DIGITALLY SIGNED', margin + 7, y + 22)
  doc.setTextColor(80, 80, 80)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.text(submittedDateTime, margin + 5, y + 28)

  // Right box - Submitted By
  const submittedByName = cycle.form_completed_by
    ? cycle.form_completed_by
    : cycle.created_by_user
      ? `${cycle.created_by_user.first_name || ''} ${cycle.created_by_user.last_name || ''}`.trim()
      : currentUser
        ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()
        : ''

  doc.setDrawColor(200, 200, 200)
  doc.rect(margin + halfWidth + 8, y, halfWidth, 30, 'S')
  doc.setTextColor(...navyBlue)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.text('SUBMITTED BY', margin + halfWidth + 11, y + 4)

  doc.setTextColor(...navyBlue)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(submittedByName, margin + halfWidth + 11, y + 10)

  doc.setDrawColor(60, 60, 60)
  doc.line(margin + halfWidth + 11, y + 14, margin + contentWidth - 5, y + 14)
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.text('Signature', margin + halfWidth + 11, y + 17)

  doc.setFillColor(232, 245, 243)
  doc.roundedRect(margin + halfWidth + 11, y + 19, 35, 4.5, 0.5, 0.5, 'F')
  doc.setDrawColor(...teal)
  doc.roundedRect(margin + halfWidth + 11, y + 19, 35, 4.5, 0.5, 0.5, 'S')
  doc.setTextColor(...teal)
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  doc.text('✓ DIGITALLY SIGNED', margin + halfWidth + 13, y + 22)
  doc.setTextColor(80, 80, 80)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.text(submittedDateTime, margin + halfWidth + 11, y + 28)

  y += 32
  doc.setDrawColor(200, 200, 200)
  doc.rect(margin, sigSectionStart, contentWidth, y - sigSectionStart + 1, 'S')
  
  // ===== FOOTER NOTICE =====
  y += 4
  doc.setFillColor(...lightBg)
  doc.roundedRect(margin, y, contentWidth, 12, 1, 1, 'F')
  doc.setDrawColor(...navyBlue)
  doc.roundedRect(margin, y, contentWidth, 12, 1, 1, 'S')
  
  doc.setTextColor(...navyBlue)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.text('Important:', margin + 3, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text('By signing this requisition, the ordering physician certifies that informed consent has been obtained from the patient', margin + 18, y + 4)
  doc.text('and/or their legal representative for the requested genetic testing. Results will be reported to the ordering physician and IVF center only.', margin + 3, y + 7.5)
  doc.text('For questions, contact Ally Genetics at (616) 465-2400 or lab@allygenetics.com.', margin + 3, y + 11)
  
  // ===== PAGE FOOTER =====
  doc.setFillColor(...navyBlue)
  doc.rect(0, pageHeight - 8, pageWidth, 0.5, 'F')
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(5.5)
  doc.text('Ally Genetics Laboratory | 1001 Parchment Dr SE, Grand Rapids, MI 49546 | (616) 465-2400 | lab@allygenetics.com | www.allygenetics.com', pageWidth / 2, pageHeight - 4, { align: 'center' })
  
  doc.save(`Requisition_${cycle.patient_last_name}_${cycle.patient_first_name}.pdf`)
}

function generateConsentPDF(cycle, signerType, consent, returnBase64 = false) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - (margin * 2)
  
  const signerName = signerType === 'patient' 
    ? `${cycle.patient_first_name} ${cycle.patient_last_name}`
    : `${cycle.partner_first_name} ${cycle.partner_last_name}`
  
  const signerEmail = signerType === 'patient' ? cycle.patient_email : cycle.partner_email
  
  // Get consent content - use stored version if available, otherwise current
  const content = consent.consent_content || getConsentContent()
  
  // Colors
  const navyBlue = [30, 58, 95] // #1e3a5f
  const teal = [13, 148, 136] // #0d9488
  const warningYellow = [254, 243, 199] // #fef3c7
  const warningBorder = [245, 158, 11] // #f59e0b
  const lightGray = [249, 250, 251] // #f9fafb
  
  let currentPage = 1
  const totalPages = 9
  
  // Helper function to add header
  function addHeader() {
    doc.setFillColor(...navyBlue)
    doc.rect(0, 0, pageWidth, 3, 'F')
    
    doc.setTextColor(...navyBlue)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Ally Genetics', margin, 12)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...teal)
    doc.text('Better Partnerships. Better Results.', margin, 16)
    
    doc.setFillColor(...navyBlue)
    doc.rect(55, 8, pageWidth - 55 - margin, 10, 'F')
  }
  
  // Helper function to add footer
  function addFooter() {
    // Doc ID and page number
    doc.setFontSize(7)
    doc.setTextColor(136, 136, 136)
    doc.text('DOC104-v40480652', margin, pageHeight - 18)
    doc.text(`Page ${currentPage} of ${totalPages}`, pageWidth - margin, pageHeight - 18, { align: 'right' })
    
    // Footer bar
    doc.setFillColor(...navyBlue)
    doc.rect(0, pageHeight - 14, pageWidth, 14, 'F')
    doc.setFontSize(6)
    doc.setTextColor(255, 255, 255)
    doc.text('phone: (616) 465-2400  |  fax: (616) 616-5887', margin, pageHeight - 8)
    doc.text('email: lab@allygenetics.com  |  web: www.allygenetics.com', pageWidth / 2, pageHeight - 8, { align: 'center' })
    doc.text('1001 Parchment Dr SE, Grand Rapids, MI 49546', pageWidth - margin, pageHeight - 8, { align: 'right' })
  }
  
  // Helper function to add section title
  function addSectionTitle(title, y) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...navyBlue)
    doc.text(title, margin, y)
    return y + 6
  }
  
  // Helper function to add paragraph text with word wrap
  function addParagraph(text, y, fontSize = 8) {
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
    const lines = doc.splitTextToSize(text, contentWidth)
    doc.text(lines, margin, y)
    return y + (lines.length * (fontSize * 0.45))
  }
  
  // Helper function for new page
  function newPage() {
    doc.addPage()
    currentPage++
    addHeader()
  }
  
  // ==================== PAGE 1 ====================
  addHeader()
  let y = 25
  
  // Consent info bar
  doc.setFillColor(232, 245, 243)
  doc.setDrawColor(...teal)
  doc.rect(margin, y, contentWidth, 10, 'FD')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navyBlue)
  doc.text('Consent Sent To:', margin + 2, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...teal)
  doc.text(signerEmail || 'N/A', margin + 28, y + 4)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navyBlue)
  doc.text('Signer:', margin + 80, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...teal)
  doc.text(`${signerName} (${signerType.charAt(0).toUpperCase() + signerType.slice(1)})`, margin + 93, y + 4)
  y += 18
  
  // Main title
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navyBlue)
  doc.text('Patient Informed Consent for Preimplantation Genetic Testing for Aneuploidy (PGT-A)', margin, y)
  y += 10
  
  // Introduction
  y = addSectionTitle('Introduction', y)
  y = addParagraph(content.sections.introduction, y)
  y += 4
  
  // Genetic Counseling
  y = addSectionTitle('Genetic Counseling', y)
  y = addParagraph(content.sections.geneticCounseling, y)
  y += 4
  
  // Chromosomal Abnormalities
  y = addSectionTitle('Chromosomal Abnormalities', y)
  y = addParagraph(content.sections.chromosomalAbnormalities, y)
  y += 4
  
  // Benefits of PGT-A
  y = addSectionTitle('Benefits of PGT-A', y)
  y = addParagraph(content.sections.benefits, y)
  
  addFooter()
  
  // ==================== PAGE 2 ====================
  newPage()
  y = 25
  
  // Embryo Biopsy Related Risks
  y = addSectionTitle('Embryo Biopsy Related Risks', y)
  y = addParagraph(content.sections.embryoBiopsyRisks, y)
  y += 2
  doc.setFontSize(8)
  content.sections.embryoBiopsyRisksList.forEach(risk => {
    y = addParagraph('• ' + risk, y)
  })
  y += 4
  
  // Fertility Center Related Risks
  y = addSectionTitle('Fertility Center Related Risks', y)
  y = addParagraph('There are also risks associated with the clinical process of IVF including:', y)
  y += 2
  content.sections.fertilityCenterRisks.forEach(risk => {
    y = addParagraph('• ' + risk, y)
  })
  y += 4
  
  // Technical and Analytic Risks
  y = addSectionTitle('Technical and Analytic Risks', y)
  y = addParagraph(content.sections.technicalRisks, y)
  y += 4
  
  // No Diagnosis
  y = addSectionTitle('No Diagnosis', y)
  y = addParagraph(content.sections.noDiagnosis, y)
  
  addFooter()
  
  // ==================== PAGE 3 ====================
  newPage()
  y = 25
  
  // Misdiagnosis
  y = addSectionTitle('Misdiagnosis', y)
  y = addParagraph(content.sections.misdiagnosis, y)
  y += 4
  
  // Technical Limits of Detection
  y = addSectionTitle('Technical Limits of Detection', y)
  y = addParagraph(content.sections.technicalLimits + ' Ally Genetics PGT-A does not detect the following abnormalities which include but are not limited to:', y)
  y += 2
  // First 4 items on page 3
  for (let i = 0; i < 4 && i < content.sections.technicalLimitsList.length; i++) {
    y = addParagraph('• ' + content.sections.technicalLimitsList[i], y)
  }
  
  addFooter()
  
  // ==================== PAGE 4 ====================
  newPage()
  y = 25
  
  // Remaining technical limits items
  for (let i = 4; i < content.sections.technicalLimitsList.length; i++) {
    y = addParagraph('• ' + content.sections.technicalLimitsList[i], y)
  }
  y += 4
  
  // Follow-Up Recommendation
  y = addSectionTitle('Follow-Up Recommendation for Prenatal Diagnosis', y)
  y = addParagraph(content.sections.followUpRecommendation, y)
  y += 4
  
  // Test Results and Interpretation
  y = addSectionTitle('Test Results and Interpretation', y)
  y = addParagraph(content.sections.testResults.normal, y)
  y += 2
  y = addParagraph(content.sections.testResults.abnormal, y)
  y = addParagraph('• ' + content.sections.testResults.trisomy, y)
  y = addParagraph('• ' + content.sections.testResults.monosomy, y)
  y = addParagraph('• ' + content.sections.testResults.complexAbnormal, y)
  y += 2
  y = addParagraph(content.sections.testResults.noDiagnosis, y)
  y = addParagraph('• ' + content.sections.testResults.insufficientDNA, y)
  y = addParagraph('• ' + content.sections.testResults.inconclusive, y)
  
  addFooter()
  
  // ==================== PAGE 5 ====================
  newPage()
  y = 25
  
  // Mosaic Results
  y = addSectionTitle('Mosaic Results', y)
  y = addParagraph(content.sections.mosaicResults, y)
  
  addFooter()
  
  // ==================== PAGE 6 ====================
  newPage()
  y = 25
  
  // Alternatives to PGT-A
  y = addSectionTitle('Alternatives to PGT-A', y)
  y = addParagraph(content.sections.alternatives, y)
  y += 4
  
  // Costs
  y = addSectionTitle('Costs', y)
  y = addParagraph(content.sections.costs, y)
  y += 4
  
  // Confidentiality and HIPAA
  y = addSectionTitle('Confidentiality and HIPAA', y)
  y = addParagraph(content.sections.confidentiality, y)
  y += 4
  
  // Retention of Samples
  y = addSectionTitle('Retention of Samples', y)
  y = addParagraph(content.sections.retentionOfSamples, y)
  
  addFooter()
  
  // ==================== PAGE 7 ====================
  newPage()
  y = 25
  
  // By signing below attestations
  y = addSectionTitle('By signing below, I attest to the following:', y)
  content.sections.attestations.forEach((attestation, index) => {
    y = addParagraph(attestation, y)
    if (index < content.sections.attestations.length - 1) y += 2
  })
  
  addFooter()
  
  // ==================== PAGE 8 ====================
  newPage()
  y = 25
  
  // Warning Box 1: PGT-A Accuracy
  doc.setFillColor(...warningYellow)
  doc.setDrawColor(...warningBorder)
  doc.setLineWidth(0.5)
  doc.rect(margin, y, contentWidth, 22, 'FD')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(146, 64, 14)
  doc.text('⚠ ' + content.warningBoxes.pgtAccuracy.title, margin + 3, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 53, 15)
  doc.setFontSize(6.5)
  const warning1Text = doc.splitTextToSize(content.warningBoxes.pgtAccuracy.text, contentWidth - 6)
  doc.text(warning1Text, margin + 3, y + 10)
  // Checkbox
  doc.setFillColor(...teal)
  doc.rect(margin + 3, y + 17, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(6)
  doc.text('✓', margin + 3.7, y + 19.5)
  doc.setTextColor(31, 41, 55)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text(content.warningBoxes.pgtAccuracy.checkbox.substring(0, 120), margin + 8, y + 19.5)
  y += 28
  
  // Warning Box 2: Sex Selection
  doc.setFillColor(...warningYellow)
  doc.rect(margin, y, contentWidth, 22, 'FD')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(146, 64, 14)
  doc.text('⚠ ' + content.warningBoxes.noSexSelection.title, margin + 3, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 53, 15)
  doc.setFontSize(6.5)
  const warning2Text = doc.splitTextToSize(content.warningBoxes.noSexSelection.text, contentWidth - 6)
  doc.text(warning2Text, margin + 3, y + 10)
  doc.setFillColor(...teal)
  doc.rect(margin + 3, y + 17, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(6)
  doc.text('✓', margin + 3.7, y + 19.5)
  doc.setTextColor(31, 41, 55)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text(content.warningBoxes.noSexSelection.checkbox.substring(0, 110), margin + 8, y + 19.5)
  y += 28
  
  // Warning Box 3: Liability Waiver
  doc.setFillColor(...warningYellow)
  doc.rect(margin, y, contentWidth, 24, 'FD')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(146, 64, 14)
  doc.text('⚠ ' + content.warningBoxes.liabilityWaiver.title, margin + 3, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 53, 15)
  doc.setFontSize(6.5)
  const warning3Text = doc.splitTextToSize(content.warningBoxes.liabilityWaiver.text, contentWidth - 6)
  doc.text(warning3Text, margin + 3, y + 10)
  doc.setFillColor(...teal)
  doc.rect(margin + 3, y + 19, 3, 3, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(6)
  doc.text('✓', margin + 3.7, y + 21.5)
  doc.setTextColor(31, 41, 55)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text(content.warningBoxes.liabilityWaiver.checkbox.substring(0, 95), margin + 8, y + 21.5)
  y += 30
  
  // Required Agreements box
  doc.setFillColor(...lightGray)
  doc.setDrawColor(229, 231, 235)
  doc.rect(margin, y, contentWidth, 28, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navyBlue)
  doc.text('Required Agreements', margin + 3, y + 5)
  y += 8
  content.requiredAgreements.forEach((text, i) => {
    doc.setFillColor(...teal)
    doc.rect(margin + 3, y + (i * 5), 2.5, 2.5, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(5)
    doc.text('✓', margin + 3.5, y + (i * 5) + 2)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.text(text, margin + 8, y + (i * 5) + 2)
  })
  y += 26
  
  // Attestation box
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.rect(margin, y, contentWidth, 30, 'FD')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navyBlue)
  doc.text('My signature below indicates that:', margin + 3, y + 5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(6.5)
  content.signatureAttestations.forEach((text, i) => {
    doc.text(`${i + 1}. ${text}`, margin + 3, y + 10 + (i * 5))
  })
  
  addFooter()
  
  // ==================== PAGE 9 - SIGNATURE ====================
  newPage()
  y = 25
  
  // Signature Section
  doc.setFillColor(...navyBlue)
  doc.rect(margin, y, contentWidth, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text(`ELECTRONIC SIGNATURE - ${signerType.toUpperCase()}`, margin + 3, y + 5.5)
  y += 12
  
  // Signature content box
  doc.setDrawColor(...navyBlue)
  doc.setLineWidth(0.5)
  doc.rect(margin, y, contentWidth, 70, 'D')
  
  // Row 1: Name and Role
  doc.setFontSize(6)
  doc.setTextColor(102, 102, 102)
  doc.setFont('helvetica', 'normal')
  doc.text('NAME (PRINT)', margin + 5, y + 8)
  doc.text('ROLE', margin + 100, y + 8)
  
  doc.setFontSize(10)
  doc.setTextColor(...teal)
  doc.text(signerName, margin + 5, y + 15)
  doc.text(signerType.charAt(0).toUpperCase() + signerType.slice(1), margin + 100, y + 15)
  
  doc.setDrawColor(51, 51, 51)
  doc.setLineWidth(0.3)
  doc.line(margin + 5, y + 17, margin + 90, y + 17)
  doc.line(margin + 100, y + 17, margin + 160, y + 17)
  
  // Row 2: Signature and Date
  doc.setFontSize(6)
  doc.setTextColor(102, 102, 102)
  doc.text('SIGNATURE', margin + 5, y + 28)
  doc.text('DATE & TIME SIGNED', margin + 100, y + 28)
  
  doc.setFontSize(14)
  doc.setTextColor(...teal)
  doc.setFont('helvetica', 'italic')
  if (consent.signature_type === 'typed' && consent.signature_data) {
    doc.text(consent.signature_data, margin + 5, y + 38)
  } else {
    doc.text(signerName, margin + 5, y + 38)
  }
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const signedDate = consent.signed_at ? new Date(consent.signed_at).toLocaleString() : 'Pending'
  doc.text(signedDate, margin + 100, y + 38)
  
  doc.setDrawColor(51, 51, 51)
  doc.line(margin + 5, y + 40, margin + 90, y + 40)
  doc.line(margin + 100, y + 40, margin + 160, y + 40)
  
  // Electronically Signed badge
  if (consent.status === 'signed') {
    doc.setFillColor(232, 245, 243)
    doc.setDrawColor(...teal)
    doc.rect(margin + 5, y + 44, 35, 6, 'FD')
    doc.setFontSize(6)
    doc.setTextColor(...teal)
    doc.setFont('helvetica', 'bold')
    doc.text('✓ ELECTRONICALLY SIGNED', margin + 7, y + 48)
  }
  
  // Verification details
  doc.setDrawColor(221, 221, 221)
  doc.line(margin + 5, y + 54, margin + contentWidth - 5, y + 54)
  doc.setFontSize(6)
  doc.setTextColor(102, 102, 102)
  doc.setFont('helvetica', 'bold')
  doc.text('Verification Details:', margin + 5, y + 59)
  doc.setFont('helvetica', 'normal')
  doc.text(`Consent Sent To: ${signerEmail || 'N/A'}  |  IP Address: ${consent.ip_address || 'N/A'}`, margin + 5, y + 64)
  doc.text(`Document ID: CON-${cycle.case_number}-${signerType.toUpperCase()}`, margin + 5, y + 68)
  
  addFooter()
  
  // Save or return
  const fileName = `Consent_${cycle.patient_last_name}_${cycle.patient_first_name}_${signerType.charAt(0).toUpperCase() + signerType.slice(1)}.pdf`
  if (returnBase64) {
    return { base64: doc.output('datauristring').split(',')[1], fileName }
  }
  doc.save(fileName)
}

function PatientCyclesModal({ patient, onClose, supabase }) {
  const { userData } = useAuth()
  const [downloading, setDownloading] = useState(null)

  async function handleDownload(cycle, docType) {
    setDownloading(`${cycle.id}-${docType}`)
    
    try {
      if (docType === 'requisition') {
        generateRequisitionPDF(cycle, userData)
      } else if (docType === 'patient-consent') {
        const consent = cycle.patientConsent
        if (consent?.signed_at) {
          generateConsentPDF(cycle, 'patient', consent)
        } else {
          alert('Patient consent has not been signed yet')
        }
      } else if (docType === 'partner-consent') {
        const consent = cycle.partnerConsent
        if (consent?.signed_at) {
          generateConsentPDF(cycle, 'partner', consent)
        } else {
          alert('Partner consent has not been signed yet')
        }
      } else if (docType === 'report' && cycle.report_file_url) {
        window.open(cycle.report_file_url, '_blank')
      }
    } catch (err) {
      console.error('Download error:', err)
      alert('Failed to download file')
    }
    
    setDownloading(null)
  }


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-ally-navy">
              {patient.last_name}, {patient.first_name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              DOB: {patient.dob ? new Date(patient.dob + 'T00:00:00').toLocaleDateString('en-US') : 'N/A'} • {patient.doctor} • {patient.cycles.length} {patient.cycles.length === 1 ? 'Cycle' : 'Cycles'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Cycles */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {patient.cycles.map((cycle, idx) => (
            <div key={cycle.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              {/* Cycle Header */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-gray-300">
                <div>
                  <h3 className="text-base font-semibold text-ally-navy flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Cycle {patient.cycles.length - idx} - {cycle.tests_ordered?.map(t => t.replace('pgt_', 'PGT-').toUpperCase()).join(', ') || 'PGT'}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Started: {new Date(cycle.created_at).toLocaleDateString('en-US')}
                  </p>
                </div>
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                  Active
                </span>
              </div>

              {/* Cycle Content Grid */}
              <div className="grid grid-cols-3 gap-3">
                {/* Forms */}
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-ally-teal" />
                    Forms
                  </div>
                  <div className="space-y-2">
                    <button 
                      onClick={() => handleDownload(cycle, 'requisition')}
                      className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-ally-teal/10 border border-gray-200 hover:border-ally-teal rounded-md transition-all text-left group"
                      disabled={downloading === `${cycle.id}-requisition`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">Requisition Form</div>
                        <div className="text-[10px] text-gray-500">
                          {new Date(cycle.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                        </div>
                      </div>
                      {downloading === `${cycle.id}-requisition` ? (
                        <Loader2 className="w-3.5 h-3.5 text-ally-teal animate-spin flex-shrink-0 ml-2" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-ally-teal flex-shrink-0 ml-2" />
                      )}
                    </button>
                    <button 
                      onClick={() => generateBiopsyWorksheetPDF(cycle)}
                      className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-ally-teal/10 border border-gray-200 hover:border-ally-teal rounded-md transition-all text-left group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">Biopsy Worksheet</div>
                        <div className="text-[10px] text-gray-500">Pre-filled from requisition</div>
                      </div>
                      <Download className="w-3.5 h-3.5 text-ally-teal flex-shrink-0 ml-2" />
                    </button>
                  </div>
                </div>

                {/* Consents */}
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-ally-teal" />
                    Consents
                  </div>
                  <div className="space-y-1.5">
                    {/* Patient Consent */}
                    <button 
                      onClick={() => handleDownload(cycle, 'patient-consent')}
                      className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-ally-teal/10 border border-gray-200 hover:border-ally-teal rounded-md transition-all text-left"
                      disabled={downloading === `${cycle.id}-patient-consent`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">
                          Patient 
                          {cycle.patientConsent?.signed_at ? (
                            <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-medium rounded">Signed</span>
                          ) : (
                            <span className="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-medium rounded">Pending</span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {cycle.patientConsent?.signed_at 
                            ? new Date(cycle.patientConsent.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                            : 'Awaiting signature'}
                        </div>
                      </div>
                      {downloading === `${cycle.id}-patient-consent` ? (
                        <Loader2 className="w-3.5 h-3.5 text-ally-teal animate-spin flex-shrink-0 ml-2" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-ally-teal flex-shrink-0 ml-2" />
                      )}
                    </button>
                    
                    {/* Partner Consent - only show if partner exists */}
                    {cycle.partner_email && (
                      <button 
                        onClick={() => handleDownload(cycle, 'partner-consent')}
                        className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-ally-teal/10 border border-gray-200 hover:border-ally-teal rounded-md transition-all text-left"
                        disabled={downloading === `${cycle.id}-partner-consent`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-900 truncate">
                            Partner 
                            {cycle.partnerConsent?.signed_at ? (
                              <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-medium rounded">Signed</span>
                            ) : (
                              <span className="ml-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-medium rounded">Pending</span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {cycle.partnerConsent?.signed_at 
                              ? new Date(cycle.partnerConsent.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                              : 'Awaiting signature'}
                          </div>
                        </div>
                        {downloading === `${cycle.id}-partner-consent` ? (
                          <Loader2 className="w-3.5 h-3.5 text-ally-teal animate-spin flex-shrink-0 ml-2" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-ally-teal flex-shrink-0 ml-2" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Reports */}
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-ally-teal" />
                    Reports
                  </div>
                  {(() => {
                    const consentSigned = cycle.patientConsent?.status === 'signed' && (!cycle.requires_partner_consent || cycle.partnerConsent?.status === 'signed')
                    if (cycle.report_file_url && consentSigned) {
                      return (
                        <button 
                          onClick={() => handleDownload(cycle, 'report')}
                          className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-ally-teal/10 border border-gray-200 hover:border-ally-teal rounded-md transition-all text-left"
                          disabled={downloading === `${cycle.id}-report`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate">PGT Report</div>
                            <div className="text-[10px] text-gray-500">
                              {cycle.report_uploaded_at ? new Date(cycle.report_uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'Available'}
                            </div>
                          </div>
                          {downloading === `${cycle.id}-report` ? (
                            <Loader2 className="w-3.5 h-3.5 text-ally-teal animate-spin flex-shrink-0 ml-2" />
                          ) : (
                            <Download className="w-3.5 h-3.5 text-ally-teal flex-shrink-0 ml-2" />
                          )}
                        </button>
                      )
                    }
                    if (cycle.report_file_url && !consentSigned) {
                      return (
                        <div className="flex items-center justify-between p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <svg className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 00-3 3v4H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V10a2 2 0 00-2-2h-2V4a3 3 0 00-3-3z" /></svg>
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-yellow-800 truncate">PGT Report</div>
                              <div className="text-[10px] text-yellow-700">Locked until consents are signed</div>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return <div className="text-center py-4 text-gray-400 text-xs">No reports yet</div>
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// ORDER SUPPLIES MODAL  
// ============================================================================
function OrderSuppliesModal({ onClose }) {
  const { supabase, userData } = useAuth()
  const [orderForm, setOrderForm] = useState({
    complete_kits: 0,
    biopsy_collection_kits: 0,
    shipping_containers: 0,
    collection_tubes: 0,
    collection_buffer: 0,
    fedex_labels: 0,
    ice_packs: 0,
    delivery_by: '',
    shipping_address: '',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Build clinic address from fields
  const getClinicAddress = () => {
    const clinic = userData.clinic
    if (!clinic) return 'No address on file'
    return [
      clinic.name,
      clinic.address,
      `${clinic.city || ''}, ${clinic.state || ''} ${clinic.zip || ''}`.trim()
    ].filter(Boolean).join('\n')
  }

  async function handleSubmitOrder(e) {
    e.preventDefault()
    setSubmitting(true)

    // Fetch full clinic address at order time
    const { data: clinicData } = await supabase
      .from('clinics')
      .select('name, address, city, state, zip')
      .eq('id', userData.clinic_id)
      .single()

    const clinicAddress = clinicData ? [
      clinicData.name,
      clinicData.address,
      `${clinicData.city || ''}, ${clinicData.state || ''} ${clinicData.zip || ''}`.trim()
    ].filter(Boolean).join('\n') : 'No address on file'

    // Save order to database
    const { data: newOrder } = await supabase.from('kit_orders').insert({
      clinic_id: userData.clinic_id,
      ordered_by_user_id: userData.id,
      status: 'pending',
      items: {
        complete_kits: orderForm.complete_kits,
        biopsy_collection_kits: orderForm.biopsy_collection_kits,
        shipping_containers: orderForm.shipping_containers,
        collection_tubes: orderForm.collection_tubes,
        collection_buffer: orderForm.collection_buffer,
        fedex_labels: orderForm.fedex_labels,
        ice_packs: orderForm.ice_packs,
      },
      delivery_by: orderForm.delivery_by || null,
      shipping_address: orderForm.shipping_address || clinicAddress,
      notes: orderForm.notes,
    }).select().single()

    // Send email notification via Edge Function
    try {
      await supabase.functions.invoke('send-order-notification', {
        body: {
          to: 'lab@allygenetics.com',
          clinic_name: userData.clinic?.name || 'Unknown Clinic',
          clinic_contact: userData.email || '',
          order_id: newOrder?.id || 'N/A',
          items: {
            complete_kits: orderForm.complete_kits,
            biopsy_collection_kits: orderForm.biopsy_collection_kits,
            shipping_containers: orderForm.shipping_containers,
            collection_tubes: orderForm.collection_tubes,
            collection_buffer: orderForm.collection_buffer,
            fedex_labels: orderForm.fedex_labels,
            ice_packs: orderForm.ice_packs,
          },
          delivery_by: orderForm.delivery_by || 'Not specified',
          shipping_address: orderForm.shipping_address || clinicAddress,
          notes: orderForm.notes || 'None',
        }
      })
    } catch (error) {
      console.error('Email notification error:', error)
    }

    setSubmitting(false)
    setSuccess(true)
  }

  function handleNewOrder() {
    setSuccess(false)
    setOrderForm({ 
      complete_kits: 0,
      biopsy_collection_kits: 0, 
      shipping_containers: 0, 
      collection_tubes: 0,
      collection_buffer: 0,
      fedex_labels: 0,
      ice_packs: 0,
      delivery_by: '',
      shipping_address: '', 
      notes: '' 
    })
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onMouseDown={onClose}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8 text-center" onMouseDown={(e) => e.stopPropagation()}>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">We Have Received Your Order</h2>
          <p className="text-gray-600 mb-6">
            Your supply order has been submitted successfully. The Ally Genetics lab team will process your order and send out your kits shortly.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleNewOrder}
              className="flex-1 bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-50"
            >
              Place Another Order
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-ally-teal text-white px-6 py-2 rounded-md hover:bg-ally-teal-dark"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-ally-navy">Order Supplies</h2>
          <p className="text-sm text-gray-600 mt-1">Request collection kits and supplies for your clinic</p>
        </div>
        <form onSubmit={handleSubmitOrder} className="p-6 space-y-6 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Complete Kits
              <span className="text-xs text-gray-500 ml-2">(1 kit = 1 shipping container, 1 return label, 6 cryo packs, 4 patient sample racks, 4 tubes (400µL) collection buffer, 40 x 0.2µL collection tubes, 40 x barcode labels)</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">Includes: shipping container, return label, cryo packs, patient sample racks, collection buffer, collection tubes, barcode labels</p>
            <input
              type="number"
              min="0"
              value={orderForm.complete_kits}
              onChange={(e) => setOrderForm(f => ({ ...f, complete_kits: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Delivery By</label>
            <input
              type="date"
              value={orderForm.delivery_by}
              onChange={(e) => setOrderForm(f => ({ ...f, delivery_by: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-4">Or order individual items:</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Patient Sample Racks</label>
            <input
              type="number"
              min="0"
              value={orderForm.biopsy_collection_kits}
              onChange={(e) => setOrderForm(f => ({ ...f, biopsy_collection_kits: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Containers</label>
            <input
              type="number"
              min="0"
              value={orderForm.shipping_containers}
              onChange={(e) => setOrderForm(f => ({ ...f, shipping_containers: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Collection Tubes (0.2µL)</label>
            <input
              type="number"
              min="0"
              value={orderForm.collection_tubes}
              onChange={(e) => setOrderForm(f => ({ ...f, collection_tubes: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Collection Buffer (400µL aliquots)</label>
            <input
              type="number"
              min="0"
              value={orderForm.collection_buffer}
              onChange={(e) => setOrderForm(f => ({ ...f, collection_buffer: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">UPS Labels</label>
            <input
              type="number"
              min="0"
              value={orderForm.fedex_labels}
              onChange={(e) => setOrderForm(f => ({ ...f, fedex_labels: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cryo Packs</label>
            <input
              type="number"
              min="0"
              value={orderForm.ice_packs}
              onChange={(e) => setOrderForm(f => ({ ...f, ice_packs: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Address</label>
            <textarea
              value={orderForm.shipping_address}
              onChange={(e) => setOrderForm(f => ({ ...f, shipping_address: e.target.value }))}
              rows={3}
              placeholder="Leave blank to use clinic address on file"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={orderForm.notes}
              onChange={(e) => setOrderForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Any special instructions or additional items needed..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (orderForm.complete_kits === 0 && orderForm.biopsy_collection_kits === 0 && orderForm.shipping_containers === 0 && orderForm.collection_tubes === 0 && orderForm.fedex_labels === 0 && orderForm.ice_packs === 0)}
              className="flex items-center gap-2 bg-ally-teal text-white px-6 py-3 rounded-md hover:bg-ally-teal-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Order
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// PATIENT FOLDER MODAL
// ============================================================================
function PatientFolderModal({ caseData, onClose, supabase }) {
  const [downloading, setDownloading] = useState(null)

  const documents = [
    { 
      id: 'requisition', 
      name: 'Requisition Form', 
      description: 'Original test requisition submission',
      icon: FileText,
      available: true 
    },
    { 
      id: 'consent', 
      name: 'Patient Consent', 
      description: 'Signed consent documentation',
      icon: CheckCircle,
      available: caseData.status !== 'consent_pending'
    },
    { 
      id: 'genetic_consult', 
      name: 'Genetic Consult', 
      description: 'Genetic counseling notes',
      icon: Users,
      available: !!caseData.genetic_consult_file
    },
    { 
      id: 'biopsy_worksheet', 
      name: 'Biopsy Worksheet', 
      description: 'Embryo biopsy details',
      icon: ClipboardList,
      available: !!caseData.biopsy_worksheet_file
    },
    { 
      id: 'report', 
      name: 'PGT Report', 
      description: 'Final testing results',
      icon: BarChart3,
      available: caseData.status === 'report_ready'
    },
  ]

  async function handleDownload(docType) {
    setDownloading(docType)
    
    if (docType === 'requisition') {
      // Fetch full case data with provider info
      const { data: fullCase, error } = await supabase
        .from('cases')
        .select(`
          *,
          provider:ordering_provider_id (
            first_name,
            last_name
          ),
          clinic:clinic_id (
            name,
            address
          )
        `)
        .eq('id', caseData.id)
        .single()
      
      if (error) {
        console.error('Error fetching case data:', error)
        setDownloading(null)
        return
      }

      // Create printable requisition HTML matching Gattaca format
      const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test Requisition - ${fullCase.case_number}</title>
  <style>
    @media print {
      @page { margin: 0.5in; }
      body { margin: 0; }
    }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.3;
      color: #000;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 15px;
      border-bottom: 3px solid #0d9488;
      padding-bottom: 10px;
    }
    .header h1 {
      color: #0d9488;
      font-size: 20pt;
      margin: 0 0 3px 0;
      font-weight: bold;
    }
    .header .subtitle {
      color: #000;
      font-size: 11pt;
      font-weight: bold;
      margin: 0;
    }
    .header .contact {
      color: #0d9488;
      font-size: 8pt;
      margin: 5px 0 0 0;
    }
    .section {
      margin-bottom: 12px;
      border: 1px solid #0d9488;
      padding: 8px;
    }
    .section-title {
      background: #0d9488;
      color: white;
      padding: 4px 8px;
      font-weight: bold;
      font-size: 9pt;
      margin: -8px -8px 8px -8px;
      text-transform: uppercase;
    }
    .row {
      display: flex;
      gap: 10px;
      margin-bottom: 6px;
    }
    .field {
      flex: 1;
      min-width: 0;
    }
    .field-label {
      font-weight: bold;
      font-size: 8pt;
      margin-bottom: 2px;
    }
    .field-value {
      border-bottom: 1px solid #000;
      padding: 2px 0;
      min-height: 16px;
      font-size: 9pt;
    }
    .checkbox-row {
      display: flex;
      gap: 15px;
      align-items: center;
      margin: 4px 0;
    }
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .checkbox {
      width: 12px;
      height: 12px;
      border: 1.5px solid #000;
      display: inline-block;
      position: relative;
    }
    .checkbox.checked::after {
      content: '✓';
      position: absolute;
      top: -3px;
      left: 1px;
      font-size: 11pt;
      font-weight: bold;
    }
    .note {
      background: #f0f0f0;
      border: 1px solid #0d9488;
      padding: 6px;
      margin: 10px 0;
      font-size: 8pt;
      font-weight: bold;
      text-align: center;
    }
    .signature-section {
      margin-top: 15px;
      border-top: 2px solid #0d9488;
      padding-top: 10px;
    }
    .sig-row {
      display: flex;
      gap: 20px;
      margin-bottom: 8px;
    }
    .sig-field {
      flex: 1;
    }
    .digital-sig {
      font-style: italic;
      color: #0d9488;
      font-size: 8pt;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Ally Genetics</h1>
    <p class="subtitle">Preimplantation Genetic Testing<br>Test Requisition Form</p>
    <p class="contact">lab@allygenetics.com | (616) 465-2400 | www.allygenetics.com</p>
  </div>

  <div class="note">
    COMPLETED TEST REQUISITION FORM MUST BE RECEIVED PRIOR TO SAMPLES & BIOPSY WORKSHEET.
  </div>

  <!-- PATIENT INFORMATION -->
  <div class="section">
    <div class="section-title">Patient Information</div>
    <div class="row">
      <div class="field">
        <div class="field-label">Patient First Name:</div>
        <div class="field-value">${fullCase.patient_first_name || ''}</div>
      </div>
      <div class="field">
        <div class="field-label">Patient Last Name:</div>
        <div class="field-value">${fullCase.patient_last_name || ''}</div>
      </div>
      <div class="field">
        <div class="field-label">Patient DOB:</div>
        <div class="field-value">${fullCase.patient_dob ? new Date(fullCase.patient_dob + 'T00:00:00').toLocaleDateString() : ''}</div>
      </div>
    </div>
    <div class="row">
      <div class="field">
        <div class="field-label">Email:</div>
        <div class="field-value">${fullCase.patient_email || ''}</div>
      </div>
      <div class="field">
        <div class="field-label">Phone:</div>
        <div class="field-value">${fullCase.patient_phone || ''}</div>
      </div>
      <div class="field"></div>
    </div>
  </div>

  <!-- PARTNER INFORMATION -->
  <div class="section">
    <div class="section-title">Partner Information</div>
    <div class="row">
      <div class="field">
        <div class="field-label">Partner First Name:</div>
        <div class="field-value">${fullCase.partner_first_name || ''}</div>
      </div>
      <div class="field">
        <div class="field-label">Partner Last Name:</div>
        <div class="field-value">${fullCase.partner_last_name || ''}</div>
      </div>
      <div class="field">
        <div class="field-label">Partner DOB:</div>
        <div class="field-value">${fullCase.partner_dob ? new Date(fullCase.partner_dob + 'T00:00:00').toLocaleDateString() : ''}</div>
      </div>
    </div>
    <div class="row">
      <div class="field">
        <div class="field-label">Email:</div>
        <div class="field-value">${fullCase.partner_email || ''}</div>
      </div>
      <div class="field">
        <div class="field-label">Phone:</div>
        <div class="field-value">${fullCase.partner_phone || ''}</div>
      </div>
      <div class="field"></div>
    </div>
  </div>

  <!-- IVF CENTER INFORMATION -->
  <div class="section">
    <div class="section-title">IVF Center Information</div>
    <div class="row">
      <div class="field" style="flex: 2;">
        <div class="field-label">IVF Center Name:</div>
        <div class="field-value">${fullCase.clinic?.name || ''}</div>
      </div>
      <div class="field">
        <div class="field-label">Phone:</div>
        <div class="field-value"></div>
      </div>
    </div>
    <div class="row">
      <div class="field" style="flex: 2;">
        <div class="field-label">Address:</div>
        <div class="field-value">${fullCase.clinic?.address || ''}</div>
      </div>
      <div class="field">
        <div class="field-label">City:</div>
        <div class="field-value"></div>
      </div>
    </div>
    <div class="row">
      <div class="field">
        <div class="field-label">State/Prov:</div>
        <div class="field-value"></div>
      </div>
      <div class="field">
        <div class="field-label">Zip Code:</div>
        <div class="field-value"></div>
      </div>
      <div class="field">
        <div class="field-label">Email:</div>
        <div class="field-value"></div>
      </div>
    </div>
  </div>

  <!-- TEST INFORMATION -->
  <div class="section">
    <div class="section-title">Test Information</div>
    <div class="checkbox-row">
      <div class="checkbox-item">
        <span class="checkbox ${fullCase.tests_ordered?.includes('pgt_a') ? 'checked' : ''}"></span>
        <span>PGT-A (Aneuploidy Screening)</span>
      </div>
      <div class="checkbox-item">
        <span class="checkbox ${fullCase.tests_ordered?.includes('pgt_sr') ? 'checked' : ''}"></span>
        <span>PGT-SR (Structural Rearrangement)</span>
      </div>
      <div class="checkbox-item" style="margin-left: auto;">
        <span class="checkbox ${fullCase.mask_sex_results ? 'checked' : ''}"></span>
        <span>Mask Sex Results</span>
      </div>
    </div>
  </div>

  <!-- CYCLE INFORMATION -->
  <div class="section">
    <div class="section-title">Cycle Information</div>
    <div class="row">
      <div class="field" style="flex:2;">
        <div class="field-label">Diagnosis / Indication for Testing:</div>
        <div class="field-value">${(() => {
          const labels = {
            advanced_maternal_age: 'Advanced maternal age (≥35)',
            recurrent_pregnancy_loss: 'Recurrent pregnancy loss',
            previous_failed_ivf: 'Previous failed IVF cycles',
            male_factor: 'Male factor infertility',
            unexplained_infertility: 'Unexplained infertility',
            previous_aneuploid_conception: 'Previous aneuploid conception',
            repetitive_implantation_failure: 'Repetitive implantation failure',
            elective_pgt_a: 'Elective PGT-A',
            pgt_sr: 'PGT-SR (Structural Rearrangement)',
            other: 'Other'
          }
          return fullCase.indication ? (labels[fullCase.indication] || fullCase.indication) : (fullCase.reason_for_testing || '')
        })()}</div>
      </div>
    </div>
    <div class="row">
      <div class="field">
        <div class="field-label">Male Factor Infertility:</div>
        <div class="field-value">${fullCase.male_factor_infertility ? 'Yes' : 'No'}</div>
      </div>
      <div class="field">
        <div class="field-label">Egg Donor:</div>
        <div class="field-value">${fullCase.is_egg_donor ? 'Yes' : 'No'}</div>
      </div>
      <div class="field">
        <div class="field-label">Sperm Donor:</div>
        <div class="field-value">${fullCase.is_sperm_donor ? 'Yes' : 'No'}</div>
      </div>
    </div>
  </div>

  <!-- SIGNATURE SECTION -->
  <div class="signature-section">
    <div class="sig-row">
      <div class="sig-field">
        <div class="field-label" style="font-weight:bold;color:#1a2e4a;font-size:9px;">ORDERING PHYSICIAN</div>
        <div class="field-value" style="font-weight:bold;font-size:13px;margin:4px 0;">${fullCase.provider ? fullCase.provider.first_name + ' ' + fullCase.provider.last_name : ''}</div>
        <div style="border-top:1px solid #555;margin:6px 0 3px;"></div>
        <div style="font-size:8px;color:#888;">Signature</div>
        <div style="display:inline-block;background:#e8f5f3;border:1px solid #1a9b85;border-radius:3px;padding:2px 8px;margin-top:4px;font-size:8px;font-weight:bold;color:#1a9b85;">✓ DIGITALLY SIGNED</div>
        <div style="font-size:8px;color:#666;margin-top:3px;">${new Date(fullCase.created_at).toLocaleString()}</div>
      </div>
      <div class="sig-field">
        <div class="field-label" style="font-weight:bold;color:#1a2e4a;font-size:9px;">SUBMITTED BY</div>
        <div class="field-value" style="font-weight:bold;font-size:13px;margin:4px 0;">${fullCase.form_completed_by || ''}</div>
        <div style="border-top:1px solid #555;margin:6px 0 3px;"></div>
        <div style="font-size:8px;color:#888;">Signature</div>
        <div style="display:inline-block;background:#e8f5f3;border:1px solid #1a9b85;border-radius:3px;padding:2px 8px;margin-top:4px;font-size:8px;font-weight:bold;color:#1a9b85;">✓ DIGITALLY SIGNED</div>
        <div style="font-size:8px;color:#666;margin-top:3px;">${new Date(fullCase.created_at).toLocaleString()}</div>
      </div>
    </div>
  </div>

  <div class="note" style="margin-top: 15px;">
    TESTING WILL NOT BE COMPLETED WITHOUT A SIGNED PATIENT CONSENT FORM.
  </div>

</body>
</html>
      `

      // Open print window
      const printWindow = window.open('', '_blank')
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
        setDownloading(null)
      }, 250)
      return
    }
    
    // For other document types, show placeholder
    setTimeout(() => {
      setDownloading(null)
      alert(`Download ${docType} - This will be connected to your file storage`)
    }, 500)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-ally-teal/10 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-ally-teal" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {caseData.patient_first_name} {caseData.patient_last_name}
              </h2>
              <p className="text-sm text-gray-500">{caseData.case_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Patient Info */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">DOB:</span>
              <span className="ml-2 font-medium">{caseData.patient_dob ? new Date(caseData.patient_dob + 'T00:00:00').toLocaleDateString() : 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500">Status:</span>
              <span className="ml-2"><StatusBadge status={caseData.status} /></span>
            </div>
            <div>
              <span className="text-gray-500">Email:</span>
              <span className="ml-2 font-medium">{caseData.patient_email || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-500">Submitted:</span>
              <span className="ml-2 font-medium">{new Date(caseData.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Patient Documents</h3>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  doc.available ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    doc.available ? 'bg-ally-teal/10' : 'bg-gray-100'
                  }`}>
                    <doc.icon className={`w-5 h-5 ${doc.available ? 'text-ally-teal' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className={`font-medium ${doc.available ? 'text-gray-900' : 'text-gray-400'}`}>{doc.name}</p>
                    <p className={`text-xs ${doc.available ? 'text-gray-500' : 'text-gray-400'}`}>{doc.description}</p>
                  </div>
                </div>
                {doc.available ? (
                  <button
                    onClick={() => handleDownload(doc.id)}
                    disabled={downloading === doc.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-ally-teal hover:bg-ally-teal/10 rounded-md transition-colors disabled:opacity-50"
                  >
                    {downloading === doc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Download
                  </button>
                ) : (
                  <span className="text-xs text-gray-400 px-3">Not available</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
          >
            Close
          </button>
          <Link
            to={`/clinic/cases/${caseData.id}`}
            className="flex items-center gap-2 px-4 py-2 bg-ally-teal text-white rounded-md hover:bg-ally-teal-dark font-medium"
          >
            View Full Details
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// ALL CASES PAGE (Admin)
// ============================================================================
function AllCasesPage() {
  const { supabase } = useAuth()
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingCase, setUploadingCase] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [clinicFilter, setClinicFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')

  function handleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }
  function SortIcon({ field }) {
    if (sortField !== field) return <span className="ml-1 text-gray-300">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [casesResult, clinicsResult] = await Promise.all([
      supabase
        .from('cases')
        .select('*, clinic:clinics(id, name), ordering_provider:providers(first_name, last_name, credentials)')
        .order('created_at', { ascending: false }),
      supabase
        .from('clinics')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
    ])
    setCases(casesResult.data || [])
    setClinics(clinicsResult.data || [])
    setLoading(false)
  }

  async function handleUploadReport(caseData, file) {
    setUploadingCase(caseData.id)
    
    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${caseData.case_number}_report_${Date.now()}.${fileExt}`
      const filePath = `reports/${caseData.clinic_id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('case-documents')
        .getPublicUrl(filePath)

      // Update case with report URL and status
      const { error: updateError } = await supabase
        .from('cases')
        .update({
          report_file_url: urlData.publicUrl,
          report_file_name: file.name,
          report_uploaded_at: new Date().toISOString(),
          status: 'report_ready'
        })
        .eq('id', caseData.id)

      if (updateError) throw updateError

      alert('Report uploaded successfully! Clinic will be notified once consents are signed.')
      fetchData()
    } catch (err) {
      console.error('Upload error:', err)
      alert('Error uploading report: ' + err.message)
    }
    
    setUploadingCase(null)
  }

  async function handleUpdateStatus(caseId, newStatus) {
    if (newStatus === 'report_ready') {
      const caseRow = cases.find(c => c.id === caseId)
      if (!caseRow?.report_file_url) {
        alert('Cannot set status to Report Ready — no report has been uploaded for this case.')
        return
      }
    }
    await supabase
      .from('cases')
      .update({ status: newStatus })
      .eq('id', caseId)
    fetchData()
  }

  async function handleDeleteCase(caseData) {
    if (!confirm(`Are you sure you want to delete case "${caseData.case_number}"?\n\nPatient: ${caseData.patient_first_name} ${caseData.patient_last_name}\n\nThis will permanently delete the case and all associated data. This action cannot be undone.`)) {
      return
    }
    
    // Delete associated consents
    await supabase.from('consents').delete().eq('case_id', caseData.id)
    
    // Delete associated biopsy worksheets
    await supabase.from('biopsy_worksheets').delete().eq('case_id', caseData.id)
    
    // Delete the case
    await supabase.from('cases').delete().eq('id', caseData.id)
    
    // Note: Files in storage remain but are orphaned - could clean up manually if needed
    
    fetchData()
  }

  const filteredCases = cases.filter(c => {
    const matchesStatus = !statusFilter || c.status === statusFilter
    const matchesClinic = !clinicFilter || c.clinic_id === clinicFilter
    const matchesSearch = !searchTerm || 
      c.patient_first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.patient_last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.case_number?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesClinic && matchesSearch
  }).sort((a, b) => {
    let aVal, bVal
    if (sortField === 'case_number') { aVal = a.case_number || ''; bVal = b.case_number || '' }
    else if (sortField === 'patient') { aVal = `${a.patient_last_name} ${a.patient_first_name}`; bVal = `${b.patient_last_name} ${b.patient_first_name}` }
    else if (sortField === 'clinic') { aVal = a.clinic?.name || ''; bVal = b.clinic?.name || '' }
    else if (sortField === 'provider') { aVal = a.ordering_provider?.last_name || ''; bVal = b.ordering_provider?.last_name || '' }
    else if (sortField === 'status') { aVal = a.status || ''; bVal = b.status || '' }
    else { aVal = a.created_at || ''; bVal = b.created_at || '' }
    return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
  })

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-ally-teal" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">All Cases</h1>
        <p className="text-gray-500">Manage all PGT cases across all clinics</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-lg border">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patient name or case #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
          />
        </div>
        <select
          value={clinicFilter}
          onChange={(e) => setClinicFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
        >
          <option value="">All Clinics</option>
          {clinics.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
        >
          <option value="">All Statuses</option>
          <option value="consent_pending">Consent Pending</option>
          <option value="consent_complete">Consent Complete</option>
          <option value="report_ready">Report Ready</option>
        </select>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th onClick={() => handleSort('case_number')} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 whitespace-nowrap w-32">Case # <SortIcon field="case_number" /></th>
                <th onClick={() => handleSort('patient')} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 whitespace-nowrap">Patient <SortIcon field="patient" /></th>
                <th onClick={() => handleSort('clinic')} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 whitespace-nowrap">Clinic <SortIcon field="clinic" /></th>
                <th onClick={() => handleSort('provider')} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 whitespace-nowrap">Provider <SortIcon field="provider" /></th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-20">Tests</th>
                <th onClick={() => handleSort('created_at')} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 whitespace-nowrap w-24">Submitted <SortIcon field="created_at" /></th>
                <th onClick={() => handleSort('status')} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 whitespace-nowrap w-40">Status <SortIcon field="status" /></th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-48">Report / Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/admin/cases/${c.id}`)}>
                  <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-ally-teal" onClick={e => e.stopPropagation()}>
                    <Link to={`/admin/cases/${c.id}`} className="hover:underline">{c.case_number || '-'}</Link>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="font-medium text-gray-900 text-sm">{c.patient_last_name}, {c.patient_first_name}</div>
                    <div className="text-xs text-gray-500">DOB: {c.patient_dob ? new Date(c.patient_dob + 'T00:00:00').toLocaleDateString() : '-'}</div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{c.clinic?.name || '-'}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                    {c.ordering_provider ? `${c.ordering_provider.first_name} ${c.ordering_provider.last_name}${c.ordering_provider.credentials ? ', ' + c.ordering_provider.credentials : ''}` : '-'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                    {c.tests_ordered?.map(t => t.replace('pgt_', 'PGT-').toUpperCase()).join(', ') || '-'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <select
                      value={c.status}
                      onChange={(e) => handleUpdateStatus(c.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ally-teal w-full"
                    >
                      <option value="consent_pending">Consent Pending</option>
                      <option value="consent_complete">Consent Complete</option>
                      <option value="report_ready">Report Ready</option>
                    </select>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-3">
                      {c.report_file_url ? (
                        <>
                          <a href={c.report_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-600 hover:underline text-xs">
                            <Download className="w-3.5 h-3.5" />Report
                          </a>
                          <label className="inline-flex items-center gap-1 text-gray-400 hover:text-ally-teal text-xs cursor-pointer">
                            <Upload className="w-3.5 h-3.5" />Replace
                            <input type="file" accept=".pdf" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUploadReport(c, e.target.files[0]) }} />
                          </label>
                        </>
                      ) : (
                        <label className="inline-flex items-center gap-1 text-ally-teal hover:underline text-xs cursor-pointer">
                          {uploadingCase === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><FileUp className="w-3.5 h-3.5" />Upload</>}
                          <input type="file" accept=".pdf" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUploadReport(c, e.target.files[0]) }} disabled={uploadingCase === c.id} />
                        </label>
                      )}
                      <button onClick={() => handleDeleteCase(c)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    {cases.length === 0 ? (<><FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" /><p>No cases yet.</p></>) : (<p>No cases match your filters.</p>)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-sm text-gray-500">Showing {filteredCases.length} of {cases.length} cases</p>
    </div>
  )
}

// ============================================================================
// CASE DETAILS PAGE
// ============================================================================
function CaseDetailsPage({ isAdmin = false }) {
  const { supabase, userData } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [caseData, setCaseData] = useState(null)
  const [consents, setConsents] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingReport, setUploadingReport] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    fetchCaseData()
  }, [id])

  async function fetchCaseData() {
    const { data: caseResult } = await supabase
      .from('cases')
      .select(`
        *,
        clinic:clinics(id, name, address, city, state, zip, phone, email),
        ordering_provider:providers(id, first_name, last_name, credentials, email),
        created_by_user:users!cases_created_by_fkey(first_name, last_name, email)
      `)
      .eq('id', id)
      .single()

    if (caseResult) {
      setCaseData(caseResult)
      
      // Fetch consents
      const { data: consentData } = await supabase
        .from('consents')
        .select('*')
        .eq('case_id', id)
        .order('created_at')
      
      setConsents(consentData || [])
    }
    setLoading(false)
  }

  async function handleDownloadConsent(signerType) {
    const consent = consents.find(c => c.signer_type === signerType)
    if (!consent || consent.status !== 'signed') return

    const signerName = signerType === 'patient'
      ? `${caseData.patient_first_name} ${caseData.patient_last_name}`
      : `${caseData.partner_first_name} ${caseData.partner_last_name}`
    const signerEmail = signerType === 'patient' ? caseData.patient_email : caseData.partner_email

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - margin * 2
    const navyBlue = [30, 58, 95]
    const teal = [13, 148, 136]

    // Header
    doc.setFillColor(...navyBlue)
    doc.rect(0, 0, pageWidth, 3, 'F')
    doc.setTextColor(...navyBlue)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Ally Genetics', margin, 12)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...teal)
    doc.text('Better Partnerships. Better Results.', margin, 16)
    doc.setFillColor(...navyBlue)
    doc.rect(55, 8, pageWidth - 55 - margin, 10, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('PGT Informed Consent - Signed Copy', 58, 14)

    let y = 25
    // Consent info bar
    doc.setFillColor(232, 245, 243)
    doc.setDrawColor(...teal)
    doc.rect(margin, y, contentWidth, 10, 'FD')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...navyBlue)
    doc.text('Consent Sent To:', margin + 2, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...teal)
    doc.text(signerEmail || 'N/A', margin + 28, y + 4)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...navyBlue)
    doc.text('Signer:', margin + 80, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...teal)
    doc.text(`${signerName} (${signerType.charAt(0).toUpperCase() + signerType.slice(1)})`, margin + 93, y + 4)
    y += 18

    // Signature section header
    doc.setFillColor(...navyBlue)
    doc.rect(margin, y, contentWidth, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(`ELECTRONIC SIGNATURE - ${signerType.toUpperCase()}`, margin + 3, y + 5.5)
    y += 12

    // Signature box
    doc.setDrawColor(...navyBlue)
    doc.setLineWidth(0.5)
    doc.rect(margin, y, contentWidth, 70, 'D')

    doc.setFontSize(6)
    doc.setTextColor(102, 102, 102)
    doc.setFont('helvetica', 'normal')
    doc.text('NAME (PRINT)', margin + 5, y + 8)
    doc.text('ROLE', margin + 100, y + 8)
    doc.setFontSize(10)
    doc.setTextColor(...teal)
    doc.text(signerName, margin + 5, y + 15)
    doc.text(signerType.charAt(0).toUpperCase() + signerType.slice(1), margin + 100, y + 15)
    doc.setDrawColor(51, 51, 51)
    doc.setLineWidth(0.3)
    doc.line(margin + 5, y + 17, margin + 90, y + 17)
    doc.line(margin + 100, y + 17, margin + 160, y + 17)

    doc.setFontSize(6)
    doc.setTextColor(102, 102, 102)
    doc.text('SIGNATURE', margin + 5, y + 28)
    doc.text('DATE & TIME SIGNED', margin + 100, y + 28)
    doc.setFontSize(14)
    doc.setTextColor(...teal)
    doc.setFont('helvetica', 'italic')
    if (consent.signature_type === 'typed' && consent.signature_data) {
      doc.text(consent.signature_data, margin + 5, y + 38)
    } else {
      doc.text(signerName, margin + 5, y + 38)
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(consent.signed_at ? new Date(consent.signed_at).toLocaleString() : '', margin + 100, y + 38)
    doc.setDrawColor(51, 51, 51)
    doc.line(margin + 5, y + 40, margin + 90, y + 40)
    doc.line(margin + 100, y + 40, margin + 160, y + 40)

    doc.setFillColor(232, 245, 243)
    doc.setDrawColor(...teal)
    doc.rect(margin + 5, y + 44, 35, 6, 'FD')
    doc.setFontSize(6)
    doc.setTextColor(...teal)
    doc.setFont('helvetica', 'bold')
    doc.text('✓ ELECTRONICALLY SIGNED', margin + 7, y + 48)

    doc.setDrawColor(221, 221, 221)
    doc.line(margin + 5, y + 54, margin + contentWidth - 5, y + 54)
    doc.setFontSize(6)
    doc.setTextColor(102, 102, 102)
    doc.setFont('helvetica', 'bold')
    doc.text('Verification Details:', margin + 5, y + 59)
    doc.setFont('helvetica', 'normal')
    doc.text(`Consent Sent To: ${signerEmail || 'N/A'}  |  IP Address: ${consent.ip_address || 'N/A'}`, margin + 5, y + 64)
    doc.text(`Document ID: CON-${caseData.case_number}-${signerType.toUpperCase()}`, margin + 5, y + 68)

    // Footer
    doc.setFillColor(...navyBlue)
    doc.rect(0, pageHeight - 14, pageWidth, 14, 'F')
    doc.setFontSize(6)
    doc.setTextColor(255, 255, 255)
    doc.text('phone: (616) 465-2400  |  fax: (616) 616-5887', margin, pageHeight - 8)
    doc.text('email: lab@allygenetics.com  |  web: www.allygenetics.com', pageWidth / 2, pageHeight - 8, { align: 'center' })
    doc.text('1001 Parchment Dr SE, Grand Rapids, MI 49546', pageWidth - margin, pageHeight - 8, { align: 'right' })

    doc.save(`Consent_${caseData.patient_last_name}_${caseData.patient_first_name}_${signerType.charAt(0).toUpperCase() + signerType.slice(1)}.pdf`)
  }

  async function handleUploadReport(file) {
    setUploadingReport(true)
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${caseData.case_number}_report_${Date.now()}.${fileExt}`
      const filePath = `reports/${caseData.clinic_id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('case-documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('case-documents')
        .getPublicUrl(filePath)

      await supabase
        .from('cases')
        .update({
          report_file_url: urlData.publicUrl,
          report_file_name: file.name,
          report_uploaded_at: new Date().toISOString(),
          status: 'report_ready'
        })
        .eq('id', id)

      // Check if consents are already complete — if so, notify clinic immediately
      try {
        const { data: fullCase } = await supabase
          .from('cases')
          .select(`*, consents(id, signer_type, status), clinic:clinics(name)`)
          .eq('id', id)
          .single()

        if (fullCase) {
          const patientSigned = fullCase.consents?.find(c => c.signer_type === 'patient')?.status === 'signed'
          const partnerSigned = !fullCase.requires_partner_consent || fullCase.consents?.find(c => c.signer_type === 'partner')?.status === 'signed'

          if (patientSigned && partnerSigned) {
            const { data: clinicUsers } = await supabase
              .from('users')
              .select('email')
              .eq('clinic_id', fullCase.clinic_id)
              .eq('is_active', true)

            if (clinicUsers?.length > 0) {
              await supabase.functions.invoke('send-report-notification', {
                body: {
                  emails: clinicUsers.map(u => u.email),
                  case_number: fullCase.case_number,
                  patient_name: `${fullCase.patient_first_name || ''} ${fullCase.patient_last_name || ''}`.trim(),
                  clinic_name: fullCase.clinic?.name || 'Clinic',
                  report_url: urlData.publicUrl,
                }
              })
              alert('Report uploaded! Clinic has been notified.')
            } else {
              alert('Report uploaded! (No active clinic users to notify.)')
            }
          } else {
            alert('Report uploaded! Clinic will be notified once consents are signed.')
          }
        }
      } catch (notifyErr) {
        console.error('Failed to send report notification after upload:', notifyErr)
        alert('Report uploaded! (Notification may not have sent — check console.)')
      }

      fetchCaseData()
    } catch (err) {
      alert('Error uploading report: ' + err.message)
    }
    
    setUploadingReport(false)
  }

  async function handleStatusChange(newStatus) {
    if (newStatus === 'report_ready' && !caseData?.report_file_url) {
      alert('Cannot set status to Report Ready — no report has been uploaded for this case.')
      return
    }
    setUpdatingStatus(true)
    await supabase
      .from('cases')
      .update({ status: newStatus })
      .eq('id', id)
    await fetchCaseData()
    setUpdatingStatus(false)
  }

  async function handleResendConsent(consent) {
    if (!consent?.consent_token) {
      alert('No consent token found.')
      return
    }
    try {
      await supabase.functions.invoke('send-consent-email', {
        body: {
          to: consent.signer_email,
          firstName: consent.signer_name?.split(' ')[0] || '',
          signerType: consent.signer_type,
          consentToken: consent.consent_token,
          caseNumber: caseData.case_number,
          clinicName: caseData.clinic?.name || ''
        }
      })
      alert(`Consent email resent to ${consent.signer_email}`)
    } catch (err) {
      console.error('Failed to resend consent:', err)
      alert('Failed to resend consent email. Please try again.')
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-ally-teal" /></div>
  }

  if (!caseData) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">Case not found.</p>
        <button onClick={() => navigate(-1)} className="text-ally-teal hover:underline mt-2">Go back</button>
      </div>
    )
  }

  const patientConsent = consents.find(c => c.signer_type === 'patient')
  const partnerConsent = consents.find(c => c.signer_type === 'partner')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button 
            onClick={() => navigate(isAdmin ? '/admin/cases' : '/clinic/cases')} 
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
          >
            ← Back to Cases
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {caseData.patient_last_name}, {caseData.patient_first_name}
          </h1>
          <p className="text-gray-500">{caseData.case_number}</p>
        </div>
        <StatusBadge status={caseData.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content - Left 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Patient Information */}
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold">Patient Information</h2>
            </div>
            <div className="p-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium">{caseData.patient_first_name} {caseData.patient_last_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date of Birth</p>
                  <p className="font-medium">{caseData.patient_dob ? new Date(caseData.patient_dob + 'T00:00:00').toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{caseData.patient_email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium">{caseData.patient_phone || '-'}</p>
                </div>
              </div>

              {/* Partner Info */}
              {(caseData.partner_first_name || caseData.partner_last_name) && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Partner Information</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium">{caseData.partner_first_name} {caseData.partner_last_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{caseData.partner_email || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Test Information */}
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold">Test Information</h2>
            </div>
            <div className="p-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Tests Ordered</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {caseData.tests_ordered?.map(test => (
                      <span key={test} className="px-3 py-1 bg-ally-teal/10 text-ally-teal rounded-full text-sm font-medium">
                        {test.replace('pgt_', 'PGT-').toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ordering Provider</p>
                  <p className="font-medium">
                    {caseData.ordering_provider 
                      ? `${caseData.ordering_provider.first_name} ${caseData.ordering_provider.last_name}, ${caseData.ordering_provider.credentials || ''}`.trim()
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Mask Sex Results</p>
                  <p className="font-medium">{caseData.mask_sex_results ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Reason for Testing</p>
                  <p className="font-medium">{caseData.reason_for_testing || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold">Documents</h2>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-ally-teal" />
                  <div>
                    <p className="font-medium">Requisition Form</p>
                    <p className="text-xs text-gray-500">Submitted {new Date(caseData.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => generateRequisitionPDF(caseData, userData)}
                  className="inline-flex items-center gap-1 text-ally-teal hover:underline text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-5 h-5 text-ally-teal" />
                  <div>
                    <p className="font-medium">Biopsy Worksheet</p>
                    <p className="text-xs text-gray-500">Pre-filled from requisition data</p>
                  </div>
                </div>
                <button
                  onClick={() => generateBiopsyWorksheetPDF(caseData)}
                  className="inline-flex items-center gap-1 text-ally-teal hover:underline text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
              {caseData.karyotype_file_path && (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-ally-teal" />
                    <div>
                      <p className="font-medium">Patient Karyotype</p>
                      <p className="text-xs text-gray-500">Uploaded with requisition</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const { data, error } = await supabase.storage
                        .from('case-files')
                        .createSignedUrl(caseData.karyotype_file_path, 60)
                      if (error) {
                        alert('Failed to generate download link: ' + error.message)
                        return
                      }
                      window.open(data.signedUrl, '_blank')
                    }}
                    className="inline-flex items-center gap-1 text-ally-teal hover:underline text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              )}
              {caseData.partner_karyotype_file_path && (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-ally-teal" />
                    <div>
                      <p className="font-medium">Partner Karyotype</p>
                      <p className="text-xs text-gray-500">Uploaded with requisition</p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const { data, error } = await supabase.storage
                        .from('case-files')
                        .createSignedUrl(caseData.partner_karyotype_file_path, 60)
                      if (error) {
                        alert('Failed to generate download link: ' + error.message)
                        return
                      }
                      window.open(data.signedUrl, '_blank')
                    }}
                    className="inline-flex items-center gap-1 text-ally-teal hover:underline text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Consent Status */}
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold">Consent Status</h2>
            </div>
            <div className="p-6 space-y-4">
              {/* Patient Consent */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {patientConsent?.signed_at ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium">Patient Consent</p>
                    <p className="text-sm text-gray-500">{caseData.patient_email}</p>
                  </div>
                </div>
                <div className="text-right">
                  {patientConsent?.signed_at ? (
                    <div className="flex items-center gap-2 justify-end">
                      <p className="text-sm text-green-600">
                        Signed {new Date(patientConsent.signed_at).toLocaleDateString()}
                      </p>
                      {isAdmin && (
                        <button
                          onClick={() => handleDownloadConsent('patient')}
                          className="text-xs text-ally-teal hover:underline flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-yellow-600">Pending</span>
                      {isAdmin && (
                        <button 
                          onClick={() => handleResendConsent(patientConsent)}
                          className="text-xs text-ally-teal hover:underline"
                        >
                          Resend
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Partner Consent (if applicable) */}
              {caseData.partner_email && (
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {partnerConsent?.signed_at ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium">Partner Consent</p>
                      <p className="text-sm text-gray-500">{caseData.partner_email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {partnerConsent?.signed_at ? (
                      <div className="flex items-center gap-2 justify-end">
                        <p className="text-sm text-green-600">
                          Signed {new Date(partnerConsent.signed_at).toLocaleDateString()}
                        </p>
                        {isAdmin && (
                          <button
                            onClick={() => handleDownloadConsent('partner')}
                            className="text-xs text-ally-teal hover:underline flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-yellow-600">Pending</span>
                        {isAdmin && (
                          <button 
                            onClick={() => handleResendConsent(partnerConsent)}
                            className="text-xs text-ally-teal hover:underline"
                          >
                            Resend
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Report Section */}
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold">Report</h2>
            </div>
            <div className="p-6">
              {(() => {
                const consentFullySigned = patientConsent?.status === 'signed' &&
                  (!caseData.requires_partner_consent || partnerConsent?.status === 'signed')
                const reportReleasable = caseData.report_file_url && (isAdmin || consentFullySigned)
                const reportLocked = caseData.report_file_url && !isAdmin && !consentFullySigned

                if (reportReleasable) {
                  return (
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="font-medium text-green-800">Report Available</p>
                          <p className="text-sm text-green-600">
                            Uploaded {caseData.report_uploaded_at ? new Date(caseData.report_uploaded_at).toLocaleDateString() : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a 
                          href={caseData.report_file_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm"
                        >
                          <Download className="w-4 h-4" />
                          Download Report
                        </a>
                        {isAdmin && (
                          <label className="flex items-center gap-1 border border-gray-300 px-3 py-2 rounded-md hover:bg-gray-50 text-sm cursor-pointer">
                            <Upload className="w-4 h-4" />
                            Replace
                            <input
                              type="file"
                              accept=".pdf"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) handleUploadReport(e.target.files[0])
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )
                }

                if (reportLocked) {
                  return (
                    <div className="flex items-center gap-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex-shrink-0">
                        <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 00-3 3v4H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V10a2 2 0 00-2-2h-2V4a3 3 0 00-3-3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-yellow-800">Report Locked</p>
                        <p className="text-sm text-yellow-700">
                          Report is ready but locked until{' '}
                          {patientConsent?.status !== 'signed' && caseData.requires_partner_consent && partnerConsent?.status !== 'signed'
                            ? 'patient and partner consents are signed'
                            : patientConsent?.status !== 'signed'
                              ? 'patient consent is signed'
                              : 'partner consent is signed'
                          }.
                        </p>
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-gray-500 mb-4">No report uploaded yet.</p>
                    {isAdmin && (
                      <label className="inline-flex items-center gap-2 bg-ally-teal text-white px-4 py-2 rounded-md hover:bg-ally-teal-dark cursor-pointer">
                        {uploadingReport ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        Upload Report
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleUploadReport(e.target.files[0])
                          }}
                          disabled={uploadingReport}
                        />
                      </label>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>

        {/* Sidebar - Right column */}
        <div className="space-y-6">
          
          {/* Status & Actions (Admin only) */}
          {isAdmin && (
            <div className="bg-white rounded-lg border">
              <div className="px-6 py-4 border-b">
                <h2 className="font-semibold">Case Status</h2>
              </div>
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Update Status</label>
                <select
                  value={caseData.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                >
                  <option value="consent_pending">Consent Pending</option>
                  <option value="consent_complete">Consent Complete</option>
                  <option value="report_ready">Report Ready</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          )}

          {/* Clinic Info */}
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold">Clinic</h2>
            </div>
            <div className="p-6">
              <p className="font-medium">{caseData.clinic?.name}</p>
              {caseData.clinic?.address && (
                <p className="text-sm text-gray-500 mt-1">
                  {caseData.clinic.address}<br />
                  {caseData.clinic.city}, {caseData.clinic.state} {caseData.clinic.zip}
                </p>
              )}
              {caseData.clinic?.phone && (
                <p className="text-sm text-gray-500 mt-2">{caseData.clinic.phone}</p>
              )}
            </div>
          </div>

          {/* Case Timeline */}
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold">Timeline</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-ally-teal rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Requisition Submitted</p>
                    <p className="text-xs text-gray-500">{new Date(caseData.created_at).toLocaleString()}</p>
                    {caseData.created_by_user && (
                      <p className="text-xs text-gray-400">by {caseData.created_by_user.first_name} {caseData.created_by_user.last_name}</p>
                    )}
                  </div>
                </div>
                
                {patientConsent?.signed_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Patient Consent Signed</p>
                      <p className="text-xs text-gray-500">{new Date(patientConsent.signed_at).toLocaleString()}</p>
                    </div>
                  </div>
                )}
                
                {partnerConsent?.signed_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Partner Consent Signed</p>
                      <p className="text-xs text-gray-500">{new Date(partnerConsent.signed_at).toLocaleString()}</p>
                    </div>
                  </div>
                )}
                
                {caseData.report_uploaded_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Report Uploaded</p>
                      <p className="text-xs text-gray-500">{new Date(caseData.report_uploaded_at).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Completed By */}
          {caseData.form_completed_by && (
            <div className="bg-white rounded-lg border">
              <div className="px-6 py-4 border-b">
                <h2 className="font-semibold">Submitted By</h2>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600">{caseData.form_completed_by}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// NEW REQUISITION FORM
// ============================================================================
function NewRequisitionPage() {
  const { supabase, userData } = useAuth()
  const navigate = useNavigate()
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [formData, setFormData] = useState({
    patient_first_name: '',
    patient_last_name: '',
    patient_dob: '',
    patient_email: '',
    patient_phone: '',
    patient_sex: 'female',
    is_egg_donor: false,
    egg_donor_age: '',
    no_partner: false,
    sperm_source: 'partner', // 'partner' or 'donor'
    sperm_donor_age: '',
    partner_first_name: '',
    partner_last_name: '',
    partner_dob: '',
    partner_email: '',
    partner_phone: '',
    partner_sex: 'male',
    is_sperm_donor: false,
    male_factor_infertility: false,
    sample_type: 'trophectoderm',
    ordering_provider_id: '',
    tests_ordered: [],
    indication: '',
    mask_sex_results: false,
    reason_for_testing: '',
    form_completed_by: '',
  })
  const [karyotypeFile, setKaryotypeFile] = useState(null)
  const [partnerKaryotypeFile, setPartnerKaryotypeFile] = useState(null)
  const [uploadingFile, setUploadingFile] = useState(false)

  useEffect(() => {
    if (userData?.clinic_id) {
      fetchProviders()
    }
  }, [userData])

  async function fetchProviders() {
    const { data } = await supabase
      .from('providers')
      .select('*')
      .eq('clinic_id', userData.clinic_id)
      .eq('is_active', true)
    setProviders(data || [])
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }
      // If "No Partner" is checked, automatically set sperm source to donor
      if (name === 'no_partner' && checked) {
        updated.sperm_source = 'donor'
      }
      return updated
    })
  }

  function handleTestChange(test) {
    setFormData(prev => ({
      ...prev,
      tests_ordered: prev.tests_ordered.includes(test)
        ? prev.tests_ordered.filter(t => t !== test)
        : [...prev.tests_ordered, test]
    }))
    // Clear karyotype files if PGT-SR is deselected
    if (test === 'pgt_sr' && formData.tests_ordered.includes('pgt_sr')) {
      setKaryotypeFile(null)
      setPartnerKaryotypeFile(null)
    }
  }

  function handleKaryotypeUpload(file) {
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }
    setKaryotypeFile(file)
  }

  function handlePartnerKaryotypeUpload(file) {
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }
    setPartnerKaryotypeFile(file)
  }

  // Determine if partner info is required
  const isPartnerRequired = !formData.no_partner

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validation
    if (formData.tests_ordered.length === 0) {
      setError('Please select at least one test')
      setLoading(false)
      return
    }

    if (!formData.ordering_provider_id) {
      setError('Please select an ordering physician')
      setLoading(false)
      return
    }

    if (!formData.form_completed_by) {
      setError('Please enter the name of the person completing this form')
      setLoading(false)
      return
    }

    if (formData.is_egg_donor && !formData.egg_donor_age) {
      setError('Please select the egg donor age')
      setLoading(false)
      return
    }

    // Partner validation
    if (isPartnerRequired) {
      if (!formData.partner_first_name || !formData.partner_last_name || !formData.partner_dob || !formData.partner_email) {
        setError('Partner information is required (First Name, Last Name, Date of Birth, and Email). Phone is optional.')
        setLoading(false)
        return
      }

      // Check that partner email is different from patient email
      if (formData.partner_email.toLowerCase() === formData.patient_email.toLowerCase()) {
        setError('Partner email must be different from patient email (used for separate consent)')
        setLoading(false)
        return
      }
    }

    if (formData.tests_ordered.includes('pgt_sr') && !karyotypeFile) {
      setError('Please upload the patient karyotype document for PGT-SR')
      setLoading(false)
      return
    }

    if (formData.tests_ordered.includes('pgt_sr') && isPartnerRequired && !partnerKaryotypeFile) {
      setError('Please upload the partner karyotype document for PGT-SR')
      setLoading(false)
      return
    }

    // Upload karyotype file if present
    let karyotype_file_path = null
    if (karyotypeFile) {
      setUploadingFile(true)
      const fileExt = karyotypeFile.name.split('.').pop()
      const fileName = `${userData.clinic_id}/${Date.now()}_karyotype.${fileExt}`
      
      const { error: uploadError } = await supabase.storage
        .from('case-files')
        .upload(fileName, karyotypeFile)
      
      if (uploadError) {
        setError('Failed to upload karyotype file: ' + uploadError.message)
        setLoading(false)
        setUploadingFile(false)
        return
      }
      karyotype_file_path = fileName
      setUploadingFile(false)
    }

    // Upload partner karyotype file if present
    let partner_karyotype_file_path = null
    if (partnerKaryotypeFile) {
      setUploadingFile(true)
      const partnerFileExt = partnerKaryotypeFile.name.split('.').pop()
      const partnerFileName = `${userData.clinic_id}/${Date.now()}_partner_karyotype.${partnerFileExt}`

      const { error: partnerUploadError } = await supabase.storage
        .from('case-files')
        .upload(partnerFileName, partnerKaryotypeFile)

      if (partnerUploadError) {
        setError('Failed to upload partner karyotype file: ' + partnerUploadError.message)
        setLoading(false)
        setUploadingFile(false)
        return
      }
      partner_karyotype_file_path = partnerFileName
      setUploadingFile(false)
    }

    // Prepare data for insertion - only include fields that have values
    const caseData = {
      clinic_id: userData.clinic_id,
      status: 'consent_pending',
      patient_first_name: formData.patient_first_name,
      patient_last_name: formData.patient_last_name,
      patient_dob: formData.patient_dob,
      patient_email: formData.patient_email,
      tests_ordered: formData.tests_ordered,
    }
    
    // Conditionally add fields only if they have values
    if (userData.id) caseData.created_by = userData.id
    caseData.requires_partner_consent = isPartnerRequired
    if (formData.patient_phone) caseData.patient_phone = formData.patient_phone
    if (formData.patient_address) caseData.patient_address = formData.patient_address
    if (formData.patient_city) caseData.patient_city = formData.patient_city
    if (formData.patient_state) caseData.patient_state = formData.patient_state
    if (formData.patient_zip) caseData.patient_zip = formData.patient_zip
    if (formData.patient_sex) caseData.patient_sex = formData.patient_sex
    if (formData.partner_first_name) caseData.partner_first_name = formData.partner_first_name
    if (formData.partner_last_name) caseData.partner_last_name = formData.partner_last_name
    if (formData.partner_dob) caseData.partner_dob = formData.partner_dob
    if (formData.partner_email) caseData.partner_email = formData.partner_email
    if (formData.partner_phone) caseData.partner_phone = formData.partner_phone
    if (formData.partner_sex) caseData.partner_sex = formData.partner_sex
    if (formData.ordering_provider_id) caseData.ordering_provider_id = formData.ordering_provider_id
    if (formData.mask_sex_results) caseData.mask_sex_results = formData.mask_sex_results
    if (formData.is_egg_donor) caseData.is_egg_donor = formData.is_egg_donor
    // Store egg donor age only if it's a numeric value (not 'unknown')
    if (formData.egg_donor_age && formData.egg_donor_age !== 'unknown') {
      caseData.egg_donor_age = parseInt(formData.egg_donor_age)
    }
    if (formData.sperm_source === 'donor') {
      caseData.is_sperm_donor = true
    } else {
      caseData.is_sperm_donor = false
    }
    // Store sperm donor age only if it's a numeric value (not 'unknown')
    if (formData.sperm_donor_age && formData.sperm_donor_age !== 'unknown') {
      caseData.sperm_donor_age = parseInt(formData.sperm_donor_age)
    }
    if (formData.male_factor_infertility) caseData.male_factor_infertility = formData.male_factor_infertility
    if (formData.sample_type) caseData.sample_type = formData.sample_type
    if (formData.indication) caseData.indication = formData.indication
    if (formData.reason_for_testing) caseData.reason_for_testing = formData.reason_for_testing
    if (formData.form_completed_by) caseData.form_completed_by = formData.form_completed_by
    if (karyotype_file_path) caseData.karyotype_file_path = karyotype_file_path
    if (partner_karyotype_file_path) caseData.partner_karyotype_file_path = partner_karyotype_file_path

    const { data: newCase, error: insertError } = await supabase
      .from('cases')
      .insert(caseData)
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // Create consent for patient with unique token
    const patientConsentToken = crypto.randomUUID()
    const { data: patientConsent } = await supabase.from('consents').insert({
      case_id: newCase.id,
      signer_type: 'patient',
      signer_name: `${formData.patient_first_name} ${formData.patient_last_name}`,
      signer_email: formData.patient_email,
      consent_for: 'patient',
      recipient_name: `${formData.patient_first_name} ${formData.patient_last_name}`,
      recipient_email: formData.patient_email,
      recipient_phone: formData.patient_phone,
      status: 'pending',
      consent_token: patientConsentToken
    }).select().single()

    // Send consent email to patient
    try {
      await supabase.functions.invoke('send-consent-email', {
        body: {
          to: formData.patient_email,
          firstName: formData.patient_first_name,
          signerType: 'patient',
          consentToken: patientConsentToken,
          caseNumber: newCase.case_number,
          clinicName: userData.clinic_name || ''
        }
      })
    } catch (emailError) {
      console.error('Failed to send patient consent email:', emailError)
      // Continue even if email fails - admin can resend
    }

    // Create consent for partner if provided and required
    if (isPartnerRequired && formData.partner_email) {
      const partnerConsentToken = crypto.randomUUID()
      const { data: partnerConsent } = await supabase.from('consents').insert({
        case_id: newCase.id,
        signer_type: 'partner',
        signer_name: `${formData.partner_first_name} ${formData.partner_last_name}`,
        signer_email: formData.partner_email,
        consent_for: 'partner',
        recipient_name: `${formData.partner_first_name} ${formData.partner_last_name}`,
        recipient_email: formData.partner_email,
        status: 'pending',
        consent_token: partnerConsentToken
      }).select().single()

      // Send consent email to partner
      try {
        await supabase.functions.invoke('send-consent-email', {
          body: {
            to: formData.partner_email,
            firstName: formData.partner_first_name,
            signerType: 'partner',
            consentToken: partnerConsentToken,
            caseNumber: newCase.case_number,
            clinicName: userData.clinic_name || ''
          }
        })
      } catch (emailError) {
        console.error('Failed to send partner consent email:', emailError)
        // Continue even if email fails - admin can resend
      }
    }

    // Send biopsy worksheet email to the submitter
    try {
      await supabase.functions.invoke('send-biopsy-worksheet-email', {
        body: {
          to: userData.email,
          submitterName: formData.form_completed_by || `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
          patientName: `${formData.patient_first_name} ${formData.patient_last_name}`,
          caseNumber: newCase.case_number,
          clinicName: userData.clinic_name || '',
          pgtType: formData.tests_ordered?.map(t => t.replace('pgt_', 'PGT-').toUpperCase()).join(', ') || '',
        }
      })
    } catch (emailError) {
      console.error('Failed to send biopsy worksheet email:', emailError)
      // Non-critical — worksheet can be downloaded from the portal
    }

    navigate('/clinic/cases/' + newCase.id)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <Link to="/clinic" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">← Back to Dashboard</Link>
        <h1 className="text-2xl font-bold text-gray-900">New Test Requisition</h1>
        <p className="text-gray-500">Submit a new PGT requisition. A consent form will be automatically sent to the patient.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800">{error}</div>
        )}

        {/* Test Information */}
        <section>
          <h2 className="text-lg font-semibold text-ally-navy border-b pb-2 mb-4">Test Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tests Ordered *</label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.tests_ordered.includes('pgt_a')}
                    onChange={() => handleTestChange('pgt_a')}
                    className="rounded border-gray-300 text-ally-teal focus:ring-ally-teal"
                  />
                  <span>PGT-A (Aneuploidy Screening)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.tests_ordered.includes('pgt_sr')}
                    onChange={() => handleTestChange('pgt_sr')}
                    className="rounded border-gray-300 text-ally-teal focus:ring-ally-teal"
                  />
                  <span>PGT-SR (Structural Rearrangements)</span>
                </label>
              </div>
            </div>
            
            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-1">Indication for PGT</label>
              <select
                name="indication"
                value={formData.indication}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              >
                <option value="">Select indication...</option>
                <option value="advanced_maternal_age">Advanced maternal age (≥35)</option>
                <option value="recurrent_pregnancy_loss">Recurrent pregnancy loss</option>
                <option value="previous_failed_ivf">Previous failed IVF cycles</option>
                <option value="male_factor">Male factor infertility</option>
                <option value="unexplained_infertility">Unexplained infertility</option>
                <option value="previous_aneuploid_conception">Previous aneuploid conception</option>
                <option value="repetitive_implantation_failure">Repetitive implantation failure</option>
                <option value="elective_pgt_a">Elective PGT-A</option>
                <option value="pgt_sr">PGT-SR (Structural Rearrangement)</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Karyotype Upload - Required for PGT-SR */}
            {formData.tests_ordered.includes('pgt_sr') && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Patient Karyotype Upload * <span className="text-amber-600 font-normal">(Required for PGT-SR)</span>
                </label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    karyotypeFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-ally-teal hover:bg-gray-50'
                  }`}
                  onClick={() => document.getElementById('karyotypeInput').click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-ally-teal', 'bg-gray-50') }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-ally-teal', 'bg-gray-50') }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-ally-teal', 'bg-gray-50')
                    if (e.dataTransfer.files[0]) handleKaryotypeUpload(e.dataTransfer.files[0])
                  }}
                >
                  <input
                    type="file"
                    id="karyotypeInput"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    onChange={(e) => e.target.files[0] && handleKaryotypeUpload(e.target.files[0])}
                  />
                  {karyotypeFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                      <span className="font-medium text-green-700">{karyotypeFile.name}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setKaryotypeFile(null) }}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DOC (Max 10MB)</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Partner Karyotype Upload - Required for PGT-SR when partner present */}
            {formData.tests_ordered.includes('pgt_sr') && isPartnerRequired && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Partner Karyotype Upload * <span className="text-amber-600 font-normal">(Required for PGT-SR)</span>
                </label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    partnerKaryotypeFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-ally-teal hover:bg-gray-50'
                  }`}
                  onClick={() => document.getElementById('partnerKaryotypeInput').click()}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-ally-teal', 'bg-gray-50') }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-ally-teal', 'bg-gray-50') }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-ally-teal', 'bg-gray-50')
                    if (e.dataTransfer.files[0]) handlePartnerKaryotypeUpload(e.dataTransfer.files[0])
                  }}
                >
                  <input
                    type="file"
                    id="partnerKaryotypeInput"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    onChange={(e) => e.target.files[0] && handlePartnerKaryotypeUpload(e.target.files[0])}
                  />
                  {partnerKaryotypeFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                      <span className="font-medium text-green-700">{partnerKaryotypeFile.name}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPartnerKaryotypeFile(null) }}
                        className="text-red-500 hover:text-red-700 ml-2"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, DOC (Max 10MB)</p>
                    </>
                  )}
                </div>
              </div>
            )}

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="mask_sex_results"
                checked={formData.mask_sex_results}
                onChange={handleChange}
                className="rounded border-gray-300 text-ally-teal focus:ring-ally-teal"
              />
              <span>Mask sex chromosome results</span>
            </label>
          </div>
        </section>

        {/* Cycle Information */}
        <section>
          <h2 className="text-lg font-semibold text-ally-navy border-b pb-2 mb-4">Cycle Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sample Type</label>
                <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700">
                  Trophectoderm
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Male Factor Infertility?</label>
                <div className="flex gap-6 mt-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="male_factor_infertility"
                      value="false"
                      checked={formData.male_factor_infertility === false}
                      onChange={() => setFormData(prev => ({ ...prev, male_factor_infertility: false }))}
                      className="border-gray-300 text-ally-teal focus:ring-ally-teal"
                    />
                    <span className="text-sm">No</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="male_factor_infertility"
                      value="true"
                      checked={formData.male_factor_infertility === true}
                      onChange={() => setFormData(prev => ({ ...prev, male_factor_infertility: true }))}
                      className="border-gray-300 text-ally-teal focus:ring-ally-teal"
                    />
                    <span className="text-sm">Yes</span>
                  </label>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Testing</label>
              <textarea
                name="reason_for_testing"
                value={formData.reason_for_testing}
                onChange={handleChange}
                rows={2}
                placeholder="Optional: Provide additional details about the reason for testing..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
          </div>
        </section>

        {/* Patient Information */}
        <section>
          <h2 className="text-lg font-semibold text-ally-navy border-b pb-2 mb-4">Patient Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                name="patient_first_name"
                value={formData.patient_first_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                name="patient_last_name"
                value={formData.patient_last_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
              <input
                type="date"
                name="patient_dob"
                value={formData.patient_dob}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email * <span className="text-gray-400 font-normal">(for consent)</span></label>
              <input
                type="email"
                name="patient_email"
                value={formData.patient_email}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                name="patient_phone"
                value={formData.patient_phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sex assigned at birth (for laboratory purposes) *</label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="patient_sex"
                    value="female"
                    checked={formData.patient_sex === 'female'}
                    onChange={handleChange}
                    className="border-gray-300 text-ally-teal focus:ring-ally-teal"
                  />
                  <span className="text-sm">Female</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="patient_sex"
                    value="male"
                    checked={formData.patient_sex === 'male'}
                    onChange={handleChange}
                    className="border-gray-300 text-ally-teal focus:ring-ally-teal"
                  />
                  <span className="text-sm">Male</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="patient_sex"
                    value="other"
                    checked={formData.patient_sex === 'other'}
                    onChange={handleChange}
                    className="border-gray-300 text-ally-teal focus:ring-ally-teal"
                  />
                  <span className="text-sm">Other</span>
                </label>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_egg_donor"
                checked={formData.is_egg_donor}
                onChange={handleChange}
                className="rounded border-gray-300 text-ally-teal focus:ring-ally-teal"
              />
              <span className="text-sm font-medium text-gray-700">Egg Donor</span>
            </label>
            {formData.is_egg_donor && (
              <div className="ml-6 max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-1">Egg Donor Age *</label>
                <select
                  name="egg_donor_age"
                  value={formData.egg_donor_age}
                  onChange={handleChange}
                  required={formData.is_egg_donor}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                >
                  <option value="">Select age...</option>
                  <option value="unknown">Unknown</option>
                  {[...Array(33)].map((_, i) => (
                    <option key={i + 18} value={i + 18}>{i + 18}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {/* Partner Information */}
        <section>
          <h2 className="text-lg font-semibold text-ally-navy border-b pb-2 mb-4">Partner Information</h2>
          <p className="text-sm text-gray-500 mb-4">If a partner is listed, they will receive a separate consent form to sign.</p>
          
          {/* No Partner and Sperm Source */}
          <div className="mb-6 space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="no_partner"
                checked={formData.no_partner}
                onChange={handleChange}
                className="rounded border-gray-300 text-ally-teal focus:ring-ally-teal"
              />
              <span className="text-sm font-medium text-gray-700">No Partner</span>
            </label>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sperm Source *</label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="sperm_source"
                    value="partner"
                    checked={formData.sperm_source === 'partner'}
                    onChange={handleChange}
                    className="border-gray-300 text-ally-teal focus:ring-ally-teal"
                  />
                  <span className="text-sm">Partner</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="sperm_source"
                    value="donor"
                    checked={formData.sperm_source === 'donor'}
                    onChange={handleChange}
                    className="border-gray-300 text-ally-teal focus:ring-ally-teal"
                  />
                  <span className="text-sm">Donor</span>
                </label>
              </div>
            </div>
            {formData.sperm_source === 'donor' && (
              <div className="ml-6 max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-1">Sperm Donor Age</label>
                <select
                  name="sperm_donor_age"
                  value={formData.sperm_donor_age}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                >
                  <option value="">Select age...</option>
                  <option value="unknown">Unknown</option>
                  {[...Array(53)].map((_, i) => (
                    <option key={i + 18} value={i + 18}>{i + 18}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Partner fields - conditionally required */}
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${!isPartnerRequired ? 'opacity-60' : ''}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name {isPartnerRequired && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                name="partner_first_name"
                value={formData.partner_first_name}
                onChange={handleChange}
                required={isPartnerRequired}
                disabled={!isPartnerRequired}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name {isPartnerRequired && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                name="partner_last_name"
                value={formData.partner_last_name}
                onChange={handleChange}
                required={isPartnerRequired}
                disabled={!isPartnerRequired}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth {isPartnerRequired && <span className="text-red-500">*</span>}
              </label>
              <input
                type="date"
                name="partner_dob"
                value={formData.partner_dob}
                onChange={handleChange}
                required={isPartnerRequired}
                disabled={!isPartnerRequired}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email {isPartnerRequired && <span className="text-red-500">*</span>}
                {isPartnerRequired && <span className="text-gray-400 font-normal"> (for consent, must differ from patient)</span>}
              </label>
              <input
                type="email"
                name="partner_email"
                value={formData.partner_email}
                onChange={handleChange}
                required={isPartnerRequired}
                disabled={!isPartnerRequired}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                name="partner_phone"
                value={formData.partner_phone}
                onChange={handleChange}
                disabled={!isPartnerRequired}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sex assigned at birth (for laboratory purposes)</label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="partner_sex"
                    value="female"
                    checked={formData.partner_sex === 'female'}
                    onChange={handleChange}
                    disabled={!isPartnerRequired}
                    className="border-gray-300 text-ally-teal focus:ring-ally-teal"
                  />
                  <span className="text-sm">Female</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="partner_sex"
                    value="male"
                    checked={formData.partner_sex === 'male'}
                    onChange={handleChange}
                    disabled={!isPartnerRequired}
                    className="border-gray-300 text-ally-teal focus:ring-ally-teal"
                  />
                  <span className="text-sm">Male</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="partner_sex"
                    value="other"
                    checked={formData.partner_sex === 'other'}
                    onChange={handleChange}
                    disabled={!isPartnerRequired}
                    className="border-gray-300 text-ally-teal focus:ring-ally-teal"
                  />
                  <span className="text-sm">Other</span>
                </label>
              </div>
            </div>
          </div>
          
          {isPartnerRequired && (
            <p className="text-xs text-amber-600 mt-3 bg-amber-50 border border-amber-200 rounded p-2">
              Partner information is required. Partner email must be different from patient email for separate consent purposes.
            </p>
          )}
          {!isPartnerRequired && (
            <p className="text-xs text-gray-500 mt-3">
              Partner information is not required when "No Partner" AND "Sperm Source: Donor" are both selected.
            </p>
          )}
        </section>

        {/* Ordering Information */}
        <section>
          <h2 className="text-lg font-semibold text-ally-navy border-b pb-2 mb-4">Ordering Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordering Physician *</label>
              <select
                name="ordering_provider_id"
                value={formData.ordering_provider_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              >
                <option value="">Select provider...</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}{p.credentials ? `, ${p.credentials}` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Form Completed By *</label>
              <input
                type="text"
                name="form_completed_by"
                value={formData.form_completed_by}
                onChange={handleChange}
                required
                placeholder="Your name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
          </div>
        </section>

        {/* Certification */}
        <section className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-ally-navy mb-4">Certification</h2>
          <div className="space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                required
                className="mt-1 rounded border-gray-300 text-ally-teal focus:ring-ally-teal"
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                I am the authorized physician or individual authorized by the physician to submit this test order.
              </span>
            </label>
            <div className="text-sm text-gray-600">
              <span className="font-medium">Signed Date:</span> {new Date().toLocaleDateString('en-US')}
            </div>
          </div>
        </section>

        {/* Submit */}
        <div className="flex items-center justify-between pt-6 border-t">
          <p className="text-sm text-gray-500">* Required fields</p>
          <div className="flex gap-3">
            <Link to="/clinic" className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-ally-teal text-white px-4 py-2 rounded-md hover:bg-ally-teal-dark disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Requisition
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ============================================================================
// CLINIC CASES PAGE
// ============================================================================
function ClinicCasesPage() {
  const { supabase, userData } = useAuth()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (userData?.clinic_id) {
      fetchCases()
    } else if (userData) {
      // User loaded but has no clinic
      setLoading(false)
    }
  }, [userData])

  async function fetchCases() {
    const { data } = await supabase
      .from('cases')
      .select('*, ordering_provider:providers(first_name, last_name, credentials)')
      .eq('clinic_id', userData.clinic_id)
      .order('created_at', { ascending: false })
    setCases(data || [])
    setLoading(false)
  }

  const filteredCases = cases.filter(c => {
    const matchesStatus = !statusFilter || c.status === statusFilter
    const matchesSearch = !searchTerm || 
      c.patient_first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.patient_last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.case_number?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-ally-teal" /></div>
  }

  // Show message if user has no clinic assigned
  if (!userData?.clinic_id) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Clinic Assigned</h2>
        <p className="text-gray-500">Your account is not associated with a clinic.</p>
        <p className="text-gray-500">Please contact an administrator.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cases</h1>
          <p className="text-gray-500">All PGT cases for your clinic</p>
        </div>
        <Link
          to="/clinic/cases/new"
          className="flex items-center gap-2 bg-ally-teal text-white px-4 py-2 rounded-md hover:bg-ally-teal-dark"
        >
          <Plus className="w-4 h-4" />
          New Requisition
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patient name or case #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal w-64"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
        >
          <option value="">All Statuses</option>
          <option value="consent_pending">Consent Pending</option>
          <option value="consent_complete">Consent Complete</option>
          <option value="report_ready">Report Ready</option>
        </select>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Case #</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tests</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCases.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-ally-teal">
                  {c.case_number || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{c.patient_last_name}, {c.patient_first_name}</div>
                  <div className="text-xs text-gray-500">DOB: {c.patient_dob ? new Date(c.patient_dob + 'T00:00:00').toLocaleDateString() : '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {c.tests_ordered?.join(', ').toUpperCase().replace('_', '-') || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {c.ordering_provider ? `Dr. ${c.ordering_provider.last_name}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <Link to={`/clinic/cases/${c.id}`} className="text-ally-teal hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {filteredCases.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  {cases.length === 0 ? (
                    <>
                      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p>No cases yet.</p>
                      <Link to="/clinic/cases/new" className="text-ally-teal hover:underline">Submit your first requisition →</Link>
                    </>
                  ) : (
                    <p>No cases match your filters.</p>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500">Showing {filteredCases.length} of {cases.length} cases</p>
    </div>
  )
}

// ============================================================================
// ORDER SUPPLIES PAGE
// ============================================================================
function OrderSuppliesPage() {
  const { supabase, userData } = useAuth()
  const [orderForm, setOrderForm] = useState({
    complete_kits: 0,
    biopsy_collection_kits: 0,
    shipping_containers: 0,
    collection_tubes: 0,
    collection_buffer: 0,
    fedex_labels: 0,
    ice_packs: 0,
    delivery_by: '',
    shipping_address: '',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Build clinic address from fields
  const getClinicAddress = () => {
    const clinic = userData.clinic
    if (!clinic) return 'No address on file'
    return [
      clinic.name,
      clinic.address,
      `${clinic.city || ''}, ${clinic.state || ''} ${clinic.zip || ''}`.trim()
    ].filter(Boolean).join('\n')
  }

  async function handleSubmitOrder(e) {
    e.preventDefault()
    setSubmitting(true)

    // Fetch full clinic address at order time
    const { data: clinicData } = await supabase
      .from('clinics')
      .select('name, address, city, state, zip')
      .eq('id', userData.clinic_id)
      .single()

    const clinicAddress = clinicData ? [
      clinicData.name,
      clinicData.address,
      `${clinicData.city || ''}, ${clinicData.state || ''} ${clinicData.zip || ''}`.trim()
    ].filter(Boolean).join('\n') : 'No address on file'

    // Save order to database
    const { data: newOrder } = await supabase.from('kit_orders').insert({
      clinic_id: userData.clinic_id,
      ordered_by_user_id: userData.id,
      status: 'pending',
      items: {
        complete_kits: orderForm.complete_kits,
        biopsy_collection_kits: orderForm.biopsy_collection_kits,
        shipping_containers: orderForm.shipping_containers,
        collection_tubes: orderForm.collection_tubes,
        collection_buffer: orderForm.collection_buffer,
        fedex_labels: orderForm.fedex_labels,
        ice_packs: orderForm.ice_packs,
      },
      delivery_by: orderForm.delivery_by || null,
      shipping_address: orderForm.shipping_address || clinicAddress,
      notes: orderForm.notes,
    }).select().single()

    // Send email notification to lab@allygenetics.com using Resend via Edge Function
    try {
      await supabase.functions.invoke('send-order-notification', {
        body: {
          to: 'lab@allygenetics.com',
          clinic_name: userData.clinic?.name || 'Unknown Clinic',
          clinic_contact: userData.email || '',
          order_id: newOrder?.id || 'N/A',
          items: {
            complete_kits: orderForm.complete_kits,
            biopsy_collection_kits: orderForm.biopsy_collection_kits,
            shipping_containers: orderForm.shipping_containers,
            collection_tubes: orderForm.collection_tubes,
            collection_buffer: orderForm.collection_buffer,
            fedex_labels: orderForm.fedex_labels,
            ice_packs: orderForm.ice_packs,
          },
          delivery_by: orderForm.delivery_by || 'Not specified',
          shipping_address: orderForm.shipping_address || clinicAddress,
          notes: orderForm.notes || 'None',
        }
      })
    } catch (error) {
      console.error('Email notification error:', error)
      // Continue anyway - order is saved in database
    }

    setSubmitting(false)
    setSuccess(true)
  }

  function handleNewOrder() {
    setSuccess(false)
    setOrderForm({ 
      complete_kits: 0,
      biopsy_collection_kits: 0, 
      shipping_containers: 0, 
      collection_tubes: 0,
      collection_buffer: 0,
      fedex_labels: 0,
      ice_packs: 0,
      delivery_by: '',
      shipping_address: '', 
      notes: '' 
    })
  }

  if (!userData?.clinic_id) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Clinic Assigned</h2>
        <p className="text-gray-500">Your account is not associated with a clinic.</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">We Have Received Your Order</h2>
          <p className="text-gray-600 mb-6">
            Your supply order has been submitted successfully. The Ally Genetics lab team will process your order and send out your kits shortly.
          </p>
          <button
            onClick={handleNewOrder}
            className="bg-ally-teal text-white px-6 py-2 rounded-md hover:bg-ally-teal-dark"
          >
            Place Another Order
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-ally-navy">Order Supplies</h2>
          <p className="text-sm text-gray-600 mt-1">Request collection kits and supplies for your clinic</p>
        </div>
        <form onSubmit={handleSubmitOrder} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Complete Kits
              <span className="text-xs text-gray-500 ml-2">(1 kit = 1 shipping container, 1 return label, 6 cryo packs, 4 patient sample racks, 4 tubes (400µL) collection buffer, 40 x 0.2µL collection tubes, 40 x barcode labels)</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">Includes: shipping container, return label, cryo packs, patient sample racks, collection buffer, collection tubes, barcode labels</p>
            <input
              type="number"
              min="0"
              value={orderForm.complete_kits}
              onChange={(e) => setOrderForm(f => ({ ...f, complete_kits: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Delivery By</label>
            <input
              type="date"
              value={orderForm.delivery_by}
              onChange={(e) => setOrderForm(f => ({ ...f, delivery_by: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-4">Or order individual items:</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Patient Sample Racks</label>
            <input
              type="number"
              min="0"
              value={orderForm.biopsy_collection_kits}
              onChange={(e) => setOrderForm(f => ({ ...f, biopsy_collection_kits: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Containers</label>
            <input
              type="number"
              min="0"
              value={orderForm.shipping_containers}
              onChange={(e) => setOrderForm(f => ({ ...f, shipping_containers: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Collection Tubes (0.2µL)</label>
            <input
              type="number"
              min="0"
              value={orderForm.collection_tubes}
              onChange={(e) => setOrderForm(f => ({ ...f, collection_tubes: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Collection Buffer (400µL aliquots)</label>
            <input
              type="number"
              min="0"
              value={orderForm.collection_buffer}
              onChange={(e) => setOrderForm(f => ({ ...f, collection_buffer: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">UPS Labels</label>
            <input
              type="number"
              min="0"
              value={orderForm.fedex_labels}
              onChange={(e) => setOrderForm(f => ({ ...f, fedex_labels: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cryo Packs</label>
            <input
              type="number"
              min="0"
              value={orderForm.ice_packs}
              onChange={(e) => setOrderForm(f => ({ ...f, ice_packs: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Address</label>
            <textarea
              value={orderForm.shipping_address}
              onChange={(e) => setOrderForm(f => ({ ...f, shipping_address: e.target.value }))}
              rows={3}
              placeholder="Leave blank to use clinic address on file"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={orderForm.notes}
              onChange={(e) => setOrderForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Any special instructions or additional items needed..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={submitting || (orderForm.complete_kits === 0 && orderForm.biopsy_collection_kits === 0 && orderForm.shipping_containers === 0 && orderForm.collection_tubes === 0 && orderForm.fedex_labels === 0 && orderForm.ice_packs === 0)}
              className="flex items-center gap-2 bg-ally-teal text-white px-6 py-3 rounded-md hover:bg-ally-teal-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Order
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// LAB STATISTICS PAGE
// ============================================================================
function LabStatisticsPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-ally-teal" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Coming Soon</h1>
        <p className="text-gray-500 text-lg">Lab Statistics and analytics dashboard will be available soon.</p>
      </div>
    </div>
  )
}

// CONTACT US PAGE
// ============================================================================
function ContactUsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contact Us</h1>
        <p className="text-gray-500">Get in touch with the Ally Genetics team</p>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Contact Info */}
        <div className="bg-white rounded-lg border p-8 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Ally Genetics Contact Information</h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-ally-teal/10 rounded-lg">
                  <Phone className="w-6 h-6 text-ally-teal" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-lg">Phone</p>
                  <a href="tel:+16164652400" className="text-ally-teal hover:underline text-lg">(616) 465-2400</a>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-ally-teal/10 rounded-lg">
                  <Mail className="w-6 h-6 text-ally-teal" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-lg">Email</p>
                  <a href="mailto:lab@allygenetics.com" className="text-ally-teal hover:underline text-lg">lab@allygenetics.com</a>
                  <p className="text-sm text-gray-500 mt-1">We respond within 24 hours</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-ally-teal/10 rounded-lg">
                  <Globe className="w-6 h-6 text-ally-teal" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-lg">Website</p>
                  <a href="https://www.allygenetics.com" target="_blank" rel="noopener noreferrer" className="text-ally-teal hover:underline text-lg">www.allygenetics.com</a>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-ally-teal/10 rounded-lg">
                  <MapPin className="w-6 h-6 text-ally-teal" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-lg">Laboratory Address</p>
                  <p className="text-gray-700 mt-1">Ally Genetics</p>
                  <p className="text-gray-700">1001 Parchment Dr SE</p>
                  <p className="text-gray-700">Grand Rapids, MI 49546</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// CLINICS PAGE (Admin)
// ============================================================================
function ClinicsPage() {
  const { supabase } = useAuth()
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingClinic, setEditingClinic] = useState(null)
  const [showProvidersModal, setShowProvidersModal] = useState(null)
  const [showClinicUsersModal, setShowClinicUsersModal] = useState(null)
  const [clinicUsers, setClinicUsers] = useState([])

  useEffect(() => {
    fetchClinics()
  }, [])

  async function fetchClinics() {
    const [clinicsResult, usersResult] = await Promise.all([
      supabase.from('clinics').select('*, providers(*)').order('name'),
      supabase.from('users').select('*').eq('role', 'clinic_user')
    ])
    setClinics(clinicsResult.data || [])
    setClinicUsers(usersResult.data || [])
    setLoading(false)
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-ally-teal" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinics</h1>
          <p className="text-gray-500">Manage client clinics and their providers</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-ally-teal text-white px-4 py-2 rounded-md hover:bg-ally-teal-dark"
        >
          <Plus className="w-4 h-4" />
          Add Clinic
        </button>
      </div>

      <div className="bg-white rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clinic Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Providers</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {clinics.map((clinic) => (
              <tr key={clinic.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{clinic.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {clinic.city && clinic.state ? `${clinic.city}, ${clinic.state}` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div>{clinic.email || '-'}</div>
                  <div>{clinic.phone || ''}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => setShowProvidersModal(clinic)}
                    className="text-ally-teal hover:underline text-sm"
                  >
                    {clinic.providers?.length || 0} providers
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => setShowClinicUsersModal(clinic)}
                    className="text-ally-teal hover:underline text-sm"
                  >
                    {clinicUsers.filter(u => u.clinic_id === clinic.id).length} users
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${clinic.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {clinic.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <button
                    onClick={() => setEditingClinic(clinic)}
                    className="text-ally-teal hover:underline mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      const userCount = clinicUsers.filter(u => u.clinic_id === clinic.id).length
                      const providerCount = clinic.providers?.length || 0
                      const { count: caseCount } = await supabase.from('cases').select('*', { count: 'exact', head: true }).eq('clinic_id', clinic.id)
                      
                      const warnings = []
                      if (caseCount > 0) warnings.push(`${caseCount} cases`)
                      if (userCount > 0) warnings.push(`${userCount} users`)
                      if (providerCount > 0) warnings.push(`${providerCount} providers`)
                      
                      let message = `Are you sure you want to delete "${clinic.name}"?`
                      if (warnings.length > 0) {
                        message += `\n\nThis will also delete: ${warnings.join(', ')}`
                      }
                      message += '\n\nThis action cannot be undone.'
                      
                      if (confirm(message)) {
                        // Delete in order: cases, users (auth + db), providers, clinic
                        await supabase.from('cases').delete().eq('clinic_id', clinic.id)
                        
                        // Get user auth_ids before deleting
                        const { data: usersToDelete } = await supabase.from('users').select('auth_id').eq('clinic_id', clinic.id)
                        await supabase.from('users').delete().eq('clinic_id', clinic.id)
                        
                        await supabase.from('providers').delete().eq('clinic_id', clinic.id)
                        await supabase.from('clinics').delete().eq('id', clinic.id)
                        
                        fetchClinics()
                      }
                    }}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {clinics.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No clinics yet. Click "Add Clinic" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Clinic Modal */}
      {(showAddModal || editingClinic) && (
        <ClinicModal
          clinic={editingClinic}
          onClose={() => { setShowAddModal(false); setEditingClinic(null); }}
          onSave={() => { fetchClinics(); setShowAddModal(false); setEditingClinic(null); }}
        />
      )}

      {/* Clinic Users Modal */}
      {showClinicUsersModal && (
        <ClinicUsersModal
          clinic={showClinicUsersModal}
          onClose={() => setShowClinicUsersModal(null)}
          onSave={() => { fetchClinics(); setShowClinicUsersModal(null); }}
        />
      )}

      {/* Providers Modal */}
      {showProvidersModal && (
        <ProvidersModal
          clinic={showProvidersModal}
          onClose={() => setShowProvidersModal(null)}
          onSave={() => fetchClinics()}
        />
      )}
    </div>
  )
}

// ============================================================================
// CLINIC MODAL (Add/Edit)
// ============================================================================
function ClinicModal({ clinic, onClose, onSave }) {
  const { supabase } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: clinic?.name || '',
    address: clinic?.address || '',
    city: clinic?.city || '',
    state: clinic?.state || '',
    zip: clinic?.zip || '',
    phone: clinic?.phone || '',
    email: clinic?.email || '',
    is_active: clinic?.is_active ?? true,
  })

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    if (clinic) {
      await supabase.from('clinics').update(formData).eq('id', clinic.id)
    } else {
      await supabase.from('clinics').insert(formData)
    }

    setLoading(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{clinic ? 'Edit Clinic' : 'Add New Clinic'}</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clinic Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
              <input
                type="text"
                name="zip"
                value={formData.zip}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="rounded border-gray-300 text-ally-teal focus:ring-ally-teal"
            />
            <span className="text-sm">Active</span>
          </label>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 bg-ally-teal text-white px-4 py-2 rounded-md hover:bg-ally-teal-dark disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {clinic ? 'Save Changes' : 'Add Clinic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// PROVIDERS MODAL
// ============================================================================

// ============================================================================
// CLINIC USERS MODAL
// ============================================================================
function ClinicUsersModal({ clinic, onClose, onSave }) {
  const { supabase, startImpersonation } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [resetSentFor, setResetSentFor] = useState(null)
  const [newUser, setNewUser] = useState({ first_name: '', last_name: '', email: '', sendWelcomeEmail: true })

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('clinic_id', clinic.id)
      .order('last_name')
    setUsers(data || [])
    setLoading(false)
  }

  async function addUser(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
      let tempPassword = ''
      for (let i = 0; i < 12; i++) tempPassword += chars.charAt(Math.floor(Math.random() * chars.length))

      // Call server-side edge function to create user (avoids browser security issues with admin API)
      const { data: createData, error: createError } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUser.email,
          password: tempPassword,
          first_name: newUser.first_name,
          last_name: newUser.last_name,
          clinic_id: clinic.id,
          sendWelcomeEmail: newUser.sendWelcomeEmail,
        }
      })
      if (createError) throw createError
      if (createData?.error) throw new Error(createData.error)

      setNewUser({ first_name: '', last_name: '', email: '', sendWelcomeEmail: true })
      setShowAddForm(false)
      setSaving(false)
      fetchUsers()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  async function deleteUser(user) {
    if (!confirm(`Are you sure you want to delete user "${user.first_name} ${user.last_name}"?\n\nThis action cannot be undone.`)) {
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Nullify foreign key references in cases and kit_orders before deleting
      await supabase.from('cases').update({ submitted_by_user_id: null }).eq('submitted_by_user_id', user.id)
      await supabase.from('cases').update({ created_by: null }).eq('created_by', user.id)
      await supabase.from('kit_orders').update({ ordered_by_user_id: null }).eq('ordered_by_user_id', user.id)
      await supabase.from('biopsy_worksheets').update({ submitted_by: null }).eq('submitted_by', user.id)

      // Now delete from public.users
      const { error: dbError } = await supabase.from('users').delete().eq('id', user.id)
      if (dbError) throw dbError

      // Delete from auth.users via edge function
      if (user.auth_id) {
        const { error: authError } = await supabase.functions.invoke('delete-user', {
          body: { auth_id: user.auth_id }
        })
        if (authError) console.warn('Auth user cleanup failed (non-critical):', authError)
      }

      fetchUsers()
    } catch (err) {
      setError('Failed to delete user: ' + err.message)
    }
    setSaving(false)
  }

  async function toggleActive(user) {
    await supabase.from('users').update({ is_active: !user.is_active }).eq('id', user.id)
    fetchUsers()
  }

  async function sendPasswordReset(user) {
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin + '/reset-password'
    })
    if (!error) setResetSentFor(user.id)
  }

  async function resendInvite(user) {
    if (!confirm(`Resend invite to ${user.email}?\n\nThis will recreate their login account and send a fresh welcome email.`)) return
    setSaving(true)
    setError(null)
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
      let tempPassword = ''
      for (let i = 0; i < 12; i++) tempPassword += chars.charAt(Math.floor(Math.random() * chars.length))

      const { data: createData, error: createError } = await supabase.functions.invoke('create-user', {
        body: {
          email: user.email,
          password: tempPassword,
          first_name: user.first_name,
          last_name: user.last_name,
          clinic_id: clinic.id,
          sendWelcomeEmail: true,
          existing_user_id: user.id,
        }
      })
      if (createError) throw createError
      if (createData?.error) throw new Error(createData.error)

      setResetSentFor(user.id)
      fetchUsers()
    } catch (err) {
      setError('Failed to resend invite: ' + err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Users at {clinic.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-ally-teal" /></div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {users.map((user) => (
                  <div key={user.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{user.last_name}, {user.first_name}</span>
                        <span className="text-sm text-gray-400 ml-2">({user.email})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(user)}
                          className={`text-sm px-2 py-1 rounded ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={() => {
                          startImpersonation(user)
                          onClose()
                          navigate('/clinic')
                        }}
                        className="flex items-center gap-1 text-xs text-ally-teal hover:text-ally-teal-dark font-medium"
                      >
                        <Eye className="w-3 h-3" /> Login As
                      </button>
                      {resetSentFor === user.id ? (
                        <span className="flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle className="w-3 h-3" /> Invite sent!
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => sendPasswordReset(user)}
                            className="flex items-center gap-1 text-xs text-gray-500 hover:text-ally-teal"
                          >
                            <Mail className="w-3 h-3" /> Reset password
                          </button>
                          <button
                            onClick={() => resendInvite(user)}
                            disabled={saving}
                            className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 font-medium"
                            title="Use this if user can't log in - recreates their auth account"
                          >
                            <RefreshCw className="w-3 h-3" /> Resend Invite
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => deleteUser(user)}
                        className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                      >
                        <X className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
                {users.length === 0 && !showAddForm && (
                  <p className="text-center text-gray-500 py-4">No users yet</p>
                )}
              </div>

              {showAddForm ? (
                <div className="border-t pt-4 space-y-3">
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">{error}</div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="First Name *"
                      value={newUser.first_name}
                      onChange={(e) => setNewUser(u => ({ ...u, first_name: e.target.value }))}
                      required
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                    />
                    <input
                      type="text"
                      placeholder="Last Name *"
                      value={newUser.last_name}
                      onChange={(e) => setNewUser(u => ({ ...u, last_name: e.target.value }))}
                      required
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                    />
                  </div>
                  <input
                    type="email"
                    placeholder="Email *"
                    value={newUser.email}
                    onChange={(e) => setNewUser(u => ({ ...u, email: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                  />
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-50 border rounded-lg p-3">
                    <input
                      type="checkbox"
                      checked={newUser.sendWelcomeEmail}
                      onChange={(e) => setNewUser(u => ({ ...u, sendWelcomeEmail: e.target.checked }))}
                      className="rounded border-gray-300 text-ally-teal focus:ring-ally-teal"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Send welcome email with password setup link</span>
                      <p className="text-xs text-gray-500">User will receive an email to set their own password</p>
                    </div>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={addUser}
                      disabled={saving}
                      className="flex items-center gap-2 bg-ally-teal text-white px-4 py-2 rounded-md hover:bg-ally-teal-dark disabled:opacity-50"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Add User
                    </button>
                    <button type="button" onClick={() => { setShowAddForm(false); setError(null) }} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 text-ally-teal hover:underline"
                >
                  <Plus className="w-4 h-4" />
                  Add User
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ProvidersModal({ clinic, onClose, onSave }) {
  const { supabase } = useAuth()
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newProvider, setNewProvider] = useState({ first_name: '', last_name: '', credentials: '', email: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchProviders()
  }, [])

  async function fetchProviders() {
    const { data } = await supabase
      .from('providers')
      .select('*')
      .eq('clinic_id', clinic.id)
      .order('last_name')
    setProviders(data || [])
    setLoading(false)
  }

  async function addProvider(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('providers').insert({ ...newProvider, clinic_id: clinic.id })
    setNewProvider({ first_name: '', last_name: '', credentials: '', email: '' })
    setShowAddForm(false)
    setSaving(false)
    fetchProviders()
    onSave()
  }

  async function toggleProviderActive(provider) {
    await supabase.from('providers').update({ is_active: !provider.is_active }).eq('id', provider.id)
    fetchProviders()
    onSave()
  }

  async function deleteProvider(provider) {
    if (!confirm(`Are you sure you want to delete provider "${provider.first_name} ${provider.last_name}"?\n\nThis action cannot be undone.`)) {
      return
    }
    await supabase.from('providers').delete().eq('id', provider.id)
    fetchProviders()
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Providers at {clinic.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-ally-teal" /></div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {providers.map((provider) => (
                  <div key={provider.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">{provider.last_name}, {provider.first_name}</span>
                      {provider.credentials && <span className="text-gray-500">, {provider.credentials}</span>}
                      {provider.email && <span className="text-sm text-gray-400 ml-2">({provider.email})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleProviderActive(provider)}
                        className={`text-sm px-2 py-1 rounded ${provider.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                      >
                        {provider.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => deleteProvider(provider)}
                        className="text-sm px-2 py-1 text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {providers.length === 0 && !showAddForm && (
                  <p className="text-center text-gray-500 py-4">No providers yet</p>
                )}
              </div>

              {showAddForm ? (
                <form onSubmit={addProvider} className="border-t pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="First Name *"
                      value={newProvider.first_name}
                      onChange={(e) => setNewProvider(p => ({ ...p, first_name: e.target.value }))}
                      required
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                    />
                    <input
                      type="text"
                      placeholder="Last Name *"
                      value={newProvider.last_name}
                      onChange={(e) => setNewProvider(p => ({ ...p, last_name: e.target.value }))}
                      required
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Credentials (MD, DO, etc.)"
                      value={newProvider.credentials}
                      onChange={(e) => setNewProvider(p => ({ ...p, credentials: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={newProvider.email}
                      onChange={(e) => setNewProvider(p => ({ ...p, email: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 bg-ally-teal text-white px-4 py-2 rounded-md hover:bg-ally-teal-dark disabled:opacity-50"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Add Provider
                    </button>
                    <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-2 text-ally-teal hover:underline"
                >
                  <Plus className="w-4 h-4" />
                  Add Provider
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// PROFILE MODAL
// ============================================================================
function ProfileModal({ onClose }) {
  const { supabase, userData } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  
  const [profileForm, setProfileForm] = useState({
    first_name: userData?.first_name || '',
    last_name: userData?.last_name || '',
  })
  
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })

  async function handleUpdateProfile(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { error } = await supabase
      .from('users')
      .update({
        first_name: profileForm.first_name,
        last_name: profileForm.last_name,
      })
      .eq('id', userData.id)

    if (error) {
      setError(error.message)
    } else {
      setMessage('Profile updated successfully')
    }
    setLoading(false)
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError('New passwords do not match')
      setLoading(false)
      return
    }

    if (passwordForm.new_password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.updateUser({
      password: passwordForm.new_password
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage('Password changed successfully')
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' })
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">My Profile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${activeTab === 'profile' ? 'border-b-2 border-ally-teal text-ally-teal' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Profile Info
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${activeTab === 'password' ? 'border-b-2 border-ally-teal text-ally-teal' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Change Password
          </button>
        </div>

        <div className="p-6">
          {message && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {activeTab === 'profile' ? (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={userData?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={profileForm.first_name}
                  onChange={(e) => setProfileForm(f => ({ ...f, first_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={profileForm.last_name}
                  onChange={(e) => setProfileForm(f => ({ ...f, last_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-ally-teal text-white px-4 py-2 rounded-md hover:bg-ally-teal-dark disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </form>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm(f => ({ ...f, new_password: e.target.value }))}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                />
                <p className="text-xs text-gray-400 mt-1">Minimum 6 characters</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm(f => ({ ...f, confirm_password: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-ally-teal text-white px-4 py-2 rounded-md hover:bg-ally-teal-dark disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Change Password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// CONSENT CONTENT - Version controlled consent text
// ============================================================================
function getConsentContent() {
  return {
    version: '2.0', // Increment this when consent text changes
    updatedAt: '2026-01-31',
    
    sections: {
      introduction: 'Preimplantation Genetic Testing for Aneuploidy (PGT-A) is a test performed on a small sample of cells from an in vitro fertilization (IVF) embryo to screen for numerical chromosomal abnormalities prior to transfer. The purpose of PGT-A is to help IVF physicians and patients decide which embryos to transfer. This consent form reviews the benefits and limitations PGT-A. Prior to initiating testing, Ally Genetics must receive a signed copy of this form. If at any time you have questions about this consent form, please email lab@allygenetics.com to schedule a consultation.',
      
      geneticCounseling: 'Ally Genetics recommends that you consult with a genetic counselor before consenting to this test and a genetic counselor or your healthcare provider about your results. For a list of independent medical genetic counselors who may be available in your area, visit the National Society of Genetic Counselors website at www.nsgc.org. Additionally, an appointment with an Ally Genetics affiliated genetic counselor can be scheduled by emailing lab@allygenetics.com. Please note that a minimum lead time of 10 business days prior to your biopsy date is required.',
      
      chromosomalAbnormalities: 'There are a total of 46 chromosomes (23 pairs) in each human cell. Half of these chromosomes are inherited from the egg and the other half from the sperm. For normal growth and development, a person must inherit the correct number of chromosomes from each reproductive parent: one each of the 22 autosomes (numbered 1–22) and a sex chromosome (X or Y). Aneuploidy refers to a type of chromosome abnormality where there are more or fewer than the normal 46 chromosomes present. The extra or missing chromosome(s) can come from the egg or the sperm, however, most come from the egg and the chance of aneuploid embryos increases with maternal age. Most aneuploid embryos do not implant and fail to achieve pregnancy; however, those that do may result in miscarriage. In the general population, 20% of all clinical pregnancies miscarry and about half are chromosomally abnormal. Additionally, some pregnancies with chromosomal abnormalities will result in the birth of a child with multiple serious health complications. A common example is Down syndrome, in which there is an extra copy of chromosome 21 (trisomy 21).',
      
      benefits: 'Chromosomally abnormal embryos may not differ in overall microscopic appearance from chromosomally normal embryos, thus making it difficult to identify which embryo(s) have the best chance of resulting in successful implantation and pregnancy. Chromosomal abnormalities are one of the most common reasons for implantation failure and miscarriages that occur within the first 12 weeks of pregnancy. PGT-A can help identify which of your embryos are most likely to be chromosomally normal (euploid). By implanting a euploid embryo, the possibility of a successful implantation rises, the risk of a miscarriage decreases, and the chances of delivering a healthy chromosomally normal baby increase.',
      
      embryoBiopsyRisks: 'Although in vitro fertilization (IVF) has been used successfully in millions of pregnancies worldwide with no documented increase in risk for congenital malformations or developmental disorders, the PGT-A process requires an embryo biopsy, and this biopsy process is not without risk. Biopsies are typically performed 5-7 days following fertilization. Such biopsies involve the removal of approximately 5-10 cells from the outer cell layer of the embryo, leaving the inner cell mass, which will become the developing baby, intact. Please note that although the biopsy samples will be sent to Ally Genetics for testing, your embryos will remain at your fertility specialist\'s facility. Your IVF physician has recommended PGT-A because they believe that the benefits of PGT-A are likely to outweigh the risks.',
      
      embryoBiopsyRisksList: [
        'An embryo may be damaged during the biopsy.',
        'It may not be possible to obtain cells from the embryo for testing or the cells obtained may not be of sufficient quality to yield results.',
        'Although data has shown that embryo biopsy has no adverse impact on growth or medical outcomes, the technique is still relatively new and the potential for unknown consequences to a live born baby cannot be excluded.'
      ],
      
      fertilityCenterRisks: [
        'It is possible that no embryos (normal or abnormal) will be available for transfer following the biopsy procedure.',
        'PGT-A results can be incorrectly interpreted and/or applied and the wrong embryo may be transferred to the uterus.',
        'Transfer of a chromosomally normal embryo does not guarantee a successful implantation nor a healthy pregnancy.'
      ],
      
      technicalRisks: 'Ally Genetics employs unique coding of collection tubes, molecular labeling of amplified DNA, and stringent sample tracking and control procedures to minimize the risk of technical errors; however, errors may still occur that result in no diagnosis or a misdiagnosis.',
      
      noDiagnosis: 'Ally Genetics is not responsible for any sample until it arrives at the Ally Genetics laboratory. Problems with the commercial shipment of samples to our laboratory could arise due to weather, air travel issues, or other circumstances beyond the control of Ally Genetics. Such problems could prevent results from being reported in time for embryo transfer, or if the integrity of the samples is compromised, results may be completely unobtainable. On rare occasions, genetic testing cannot be performed due to improper biopsy techniques, loss of biopsied cells, or poor DNA quality within the biopsied cells themselves. Laboratory errors, both technical and human, while also rare, can result in irrecoverable test failure. Embryo biopsies that fail to amplify cannot be retested. In such cases, a 2nd biopsy (rebiopsy), with its own risks and fees, is the only way to make an additional attempt at obtaining results. At their discretion, if an Ally Genetics error results in test failure, there will be no charge for PGT-A of the failed samples and their corresponding rebiopsies; however, no further compensation will be provided.',
      
      misdiagnosis: 'No genetic testing is 100% accurate and PGT-A is no different. Because only a small number of cells are biopsied from the outer layer of the embryo, the sample may not be representative of the entire embryo\'s chromosomal makeup. A false negative result will indicate an embryo has a normal number of chromosomes when there is actually a chromosomal abnormality. A false positive result will indicate an embryo has an abnormal chromosome copy number when it is actually normal, potentially leading to the discard of viable embryos. Additionally, sex chromosome discrepancies are possible (incorrect gender prediction). One recognized source of misdiagnosis is embryo mosaicism; a phenomenon in which the cells biopsied and analyzed are not genetically representative of the remainder of the embryo. Mosaicism may or may not be detected by PGT-A. Other reasons for misdiagnosis include but are not limited to sample mix-up, technical difficulties, abnormalities beyond the scope or detection limit of the technology employed, human error, and sample contamination. The use of non-validated sample collection and handling procedures and spontaneous conception in which pregnancy arises due to sexual intercourse rather than the transferred PGT-A tested embryo, can lead to misdiagnosis. Accordingly, abstinence from intercourse is recommended for two weeks before and after embryo transfer.',
      
      technicalLimits: 'Ally Genetics uses a technique known as Next Generation Sequencing (NGS) to evaluate the amount of chromosomal material present across the entire genome and identifies regions of missing or extra information. NGS can detect whole chromosome aneuploidies (entire extra or missing chromosomes) as well as some types of segmental aneuploidies (missing or extra segments of chromosomes). This test cannot detect chromosomal abnormalities without an imbalance in genetic material.',
      
      technicalLimitsList: [
        'Single gene disorders – PGT-A for aneuploidy does not analyze specific genes and cannot detect conditions caused by single gene mutations, such as Cystic Fibrosis, Spinal Muscular Atrophy, Sickle Cell Anemia etc.',
        'Multifactorial conditions – Conditions that are caused by a combination of genetic and environmental factors, such as diabetes, schizophrenia, developmental delay, intellectual disability, and autism spectrum disorders are not detected.',
        'Polyploidy/Haploidy – Polyploidy is a state in which there is an entire additional set(s) of chromosomes. Haploidy is a state in which there is only a single complete set of chromosomes. This test cannot detect homogenous polyploidy/haploidy.',
        'Balanced chromosomal rearrangements – Balanced chromosomal rearrangements, such as balanced translocations and inversions cannot be identified by this test.',
        'Uniparental disomy (UPD) – UPD is the presence of two copies of a chromosome from one parent and none from the other. UPD for certain chromosomes is associated with genetic syndromes that might include cognitive or physical disabilities. Genome-wide UPD of paternal origin can result in a molar pregnancy. UPD cannot be detected by this test.',
        'Small segmental changes – PGT-A technology is designed to test for aneuploidy (whole chromosomes that are extra or missing). It can also detect segmental aneuploidy, including deletions, duplications, and unbalanced rearrangements, depending on the size of the chromosome segment involved. Extra or missing chromosome segments, smaller than 20Mb, may not be detected.'
      ],
      
      followUpRecommendation: 'PGT-A cannot guarantee the birth of a chromosomally normal child. Due to inherent limitations, PGT-A should not be viewed as a replacement for prenatal testing and prenatal testing for ongoing pregnancies is recommended. Prenatal testing options can include noninvasive pregnancy screening (NIPS/NIPT) and diagnostic testing by chorionic villus sampling (CVS) or amniocentesis. Your prenatal provider and/or a prenatal genetic counselor can discuss which type of prenatal testing may be most appropriate for you.',
      
      testResults: {
        normal: 'Normal (Euploid): No whole chromosome or segmental abnormalities larger than 20Mb were detected.',
        abnormal: 'Abnormal (Aneuploid): One or more whole chromosome or segmental chromosome abnormality was detected.',
        trisomy: 'Trisomy: The presence of three copies of a chromosome rather than the normal two. A trisomic sample indicates the corresponding embryo is at a very high risk of being chromosomally abnormal.',
        monosomy: 'Monosomy: The presence of one copy of a chromosome rather than the normal two. A monosomic sample indicates the corresponding embryo is at a very high risk of being chromosomally abnormal.',
        complexAbnormal: 'Complex Abnormal: The presence of five or more aneuploidy events. A complex abnormal sample indicates the corresponding embryo is at a very high risk of being chromosomally abnormal.',
        noDiagnosis: 'No Diagnosis: The chromosomal health of embryos whose samples yield a "No Diagnosis" designation should be considered unknown.',
        insufficientDNA: 'Insufficient Template DNA: No diagnosis due to insufficient template DNA indicates the failure of a sample\'s DNA to amplify enough to warrant further testing.',
        inconclusive: 'Inconclusive Results: Ally Genetics PGT-A uses a statistical model to call the number of chromosomes for each embryo sample. In some cases, due to degraded DNA or other sample aberrations, data will not conform to the statistical model.'
      },
      
      mosaicResults: 'At this time, Ally Genetics reports samples as mosaic when more than 40% and less than 70% of a sample biopsy\'s amplified DNA appears aneuploid (abnormal), based on our own internal validation studies and the research available at the time this document was written. Mosaic embryos contain two or more populations of cells with differing chromosome content (e.g. some cells are euploid (normal) and others aneuploid (abnormal)). Mosaicism is a relatively common phenomenon in human preimplantation embryos. Even if not detected, PGT-A cannot rule out mosaicism as only a few cells are biopsied and analyzed from each embryo. There is a high correlation between the biopsied sample and the whole embryo; however, the exact correlation has yet to be determined and your sample may not reflect the true chromosomal composition of the embryo as a whole. The outcome of transferring an embryo with a mosaic PGT-A result cannot be predicted. A mosaic embryo may not implant, may result in a spontaneous miscarriage, may develop abnormally, or may result in the birth of a child with mild to severe birth defects and/or intellectual disabilities. Due to the uncertainty surrounding PGT-A mosaic embryos, Ally Genetics does not recommend their transfer; however, the determination of which embryo(s) to transfer and/or discard should always be made with the guidance of your physician and/or a licensed genetic counselor.',
      
      alternatives: 'The risks, benefits, and alternatives to PGT-A should be discussed thoroughly with your physician, genetic counselor, or the authorized person ordering this test. PGT-A is an optional test that is offered to improve the likelihood of having a successful pregnancy and a healthy child. You are not obligated to undergo PGT-A, even if your fertility specialist recommends it. If you do not wish to undergo PGT-A but wish to know the chromosomal status of your pregnancy, prenatal screening, prenatal diagnosis, and ultrasound examination are also available as alternative ways to evaluate chromosomal abnormalities and/or birth defects.',
      
      costs: 'Fees for PGT-A are in addition to any other costs associated with your IVF treatment. Ally Genetics does not accept insurance for the coverage of these fees. All fees paid to Ally Genetics are due when samples arrive at our laboratory. Fees must be paid to Ally Genetics directly or paid to your IVF center, depending on the payment procedure chosen by your IVF provider. Samples with all required documents and information are processed in the order received. Once testing has begun, Ally Genetics cannot stop sample processing and the full cost of testing will be incurred. For the vast majority of samples received, results will be reported to your IVF clinic within 14 days. Billing questions are best answered by the Ally Genetics support team via lab@allygenetics.com.',
      
      confidentiality: 'Ally Genetics keeps test results confidential and is in compliance with all Health Insurance Portability and Accountability Act (HIPAA) regulations. Ally Genetics will release your test results only to the referring physician, genetic counselor, reference laboratory, patient, or patient\'s representative in order to protect patient confidentiality. All other releases of results must be directed by you (or a person legally authorized to act on your behalf) in writing, or as otherwise required by federal and Michigan state laws. The Department of Health of your state and the Food and Drug Administration (FDA) may also inspect the records.',
      
      retentionOfSamples: 'Ally Genetics is committed to improving the field of preimplantation genetics and may contact your IVF center for information regarding the outcome of your IVF cycle. Additionally, results of this testing may be presented in aggregate at scientific/medical meetings or published in scientific journals or other publications; however, your identity will not be disclosed. PGT-A samples and/or DNA may be discarded after a time period of 60 days following results reporting or the discontinuation of testing for any reason. Ally Genetics is not obligated to store DNA samples obtained from embryo biopsies; however, we will attempt to honor reasonable written requests from your physician in cases of medical necessity. Ally Genetics may keep leftover de-identified sample DNA for ongoing research. If your samples are to be used for research, they will be de-identified, and resulting data will not contain any of your protected health information. All identifiers associated with such samples and/or sample data will be removed prior to publication or release to any outside collaborator of Ally Genetics. The goal of this research is to increase the knowledge related to infertility and to help couples have healthy babies. Your sample material will never be used to make new embryos or future babies. You will not be entitled to receive any payment, benefits, or rights to any resulting products or discoveries based on this research. If you do not want your de-identified samples used, you may email a request for sample destruction to lab@allygenetics.com within 60 days after test results have been issued. Declining to allow your samples to be used for research will in no way affect the quality of care provided to you by Ally Genetics.',
      
      attestations: [
        'I have read the complete consent form and have decided to proceed with preimplantation genetic testing for aneuploidy (PGT-A). I request that Ally Genetics perform PGT-A on all embryo biopsy samples sent by our IVF team during our IVF cycle. This consent applies to this and all future IVF cycles in which I request PGT-A testing with Ally Genetics.',
        'I acknowledge the indications, procedures, risks, limitations, and complications of the proposed test, as well as the financial cost of said test(s).',
        'I understand that PGT-A can determine the number of chromosomes present in an embryo, but that PGT-A is not 100% accurate, cannot detect all chromosomal abnormalities, and does not guarantee a healthy baby nor a particular gender.',
        'I understand that my/our pregnancy must be followed by an IVF physician, obstetrician, and/or other appropriately trained healthcare professional and that PGT-A is not a substitute for prenatal diagnosis (CVS or amniocentesis). Additionally, prenatal screening may be recommended regardless of the use of PGT-A.',
        'I understand and accept Ally Genetic\'s research and sample retention policies as well as how to request sample destruction after testing.',
        'I understand it is my responsibility to schedule genetic counseling. I have been given the opportunity to talk with an Ally Genetics affiliated genetic counselor by phone and to ask questions about PGT-A and the information contained in this consent form.',
        'I acknowledge that Ally Genetics, its employees, directors, and authorized agents may not be held liable in any manner whatsoever for any birth defects, chromosomal abnormalities, false positive findings, false negative findings, gender misidentifications, shipping or transport errors, nor for any damage in contract or tort arising out of the PGT-A.',
        'I acknowledge that any legal controversy, dispute, or disagreement arising out of the services provided by Ally Genetics or any subsidiary thereof shall be settled by binding arbitration by the American Arbitration Association, under the applicable Arbitration Rules then in effect. Information may be obtained, and claims may be filed in the state of Michigan office of the American Arbitration Association. All disputes shall be decided under the laws of the state of Michigan.'
      ]
    },
    
    warningBoxes: {
      pgtNoPregnancyIncrease: {
        title: 'Please read and acknowledge',
        text: 'PGT-A may help identify embryos with the expected number of chromosomes. However, PGT-A has not been shown to improve pregnancy or live-birth rates for all patients undergoing IVF. Individual outcomes vary based on factors such as age, embryo number and embryo quality.',
        checkbox: 'I acknowledge that PGT-A does not guarantee pregnancy or live birth and has not been shown to improve outcomes for all patients.'
      },
      pgtAccuracy: {
        title: 'Please read and acknowledge',
        text: 'I understand that PGT-A is not 100% accurate. The biopsied cells may not be representative of the entire embryo, which means a chromosomally normal embryo could be misclassified as abnormal, potentially leading to the discard of a viable embryo.',
        checkbox: 'I acknowledge and understand that PGT-A is not 100% accurate, that the biopsied cells may not represent the entire embryo, and that viable embryos could potentially be misclassified and discarded'
      },
      noSexSelection: {
        title: 'Please read and acknowledge',
        text: 'Ally Genetics does not recommend, direct, or facilitate embryo selection for nonmedical sex selection or family-balancing purposes. PGT-A generally provides an accurate prediction of an embryo’s chromosomal sex; however, no laboratory test is 100% accurate, and rare discrepancies may occur.',
        checkbox: 'I acknowledge that Ally Genetics does not recommend, direct, or facilitate embryo selection for nonmedical sex selection or family balancing, and that chromosomal sex predictions from PGT-A are not guaranteed.'
      },
      liabilityWaiver: {
        title: 'Please read and acknowledge',
        text: 'By signing this consent, I agree not to hold Ally Genetics, its employees, directors, and authorized agents legally responsible for any misdiagnosis, including but not limited to false positive findings, false negative findings, gender misidentifications, or any other errors arising from the inherent limitations of PGT-A testing. I understand that PGT-A is a screening tool with known limitations and is not a guarantee of embryo health or pregnancy outcome.',
        checkbox: 'I acknowledge and agree that I will not hold Ally Genetics legally responsible for any misdiagnosis or testing errors, and I understand that PGT-A results do not guarantee a healthy pregnancy or baby'
      }
    },
    
    requiredAgreements: [
      'I have read and understood this consent form in its entirety',
      'I consent to the use of electronic signatures and electronic records for this consent form',
      'I agree to all terms stated in this consent form and voluntarily consent to Preimplantation Genetic Testing',
      'I understand that Ally Genetics does not accept insurance and that payment in full must be received prior to the release of results'
    ],
    
    signatureAttestations: [
      'I have read, or have had read to me and understand this patient consent form.',
      'The decision to consent to, or refuse, the above testing is entirely mine.',
      'I have had the opportunity to discuss the pros and cons of proceeding, including the purposes, limitations, and possible risks, with my healthcare provider, a genetic counselor, and/or someone my healthcare provider has designated.',
      'I have all the information I desire and require to make an informed decision and all my questions have been satisfactorily answered.'
    ]
  }
}

// ============================================================================
// CONSENT SIGNING PAGE (Public - No Auth Required)
// ============================================================================
function ConsentSigningPage() {
  const { token } = useParams()
  const { supabase } = useAuth()
  const [loading, setLoading] = useState(true)
  const [consent, setConsent] = useState(null)
  const [caseData, setCaseData] = useState(null)
  const [error, setError] = useState(null)
  const [signatureType, setSignatureType] = useState('typed') // 'typed' or 'drawn'
  const [typedName, setTypedName] = useState('')
  const sigCanvas = useRef(null)
  const [checkboxes, setCheckboxes] = useState({
    readUnderstood: false,
    electronicConsent: false,
    agreeTerms: false,
    insurancePayment: false,
    keyPointPregnancy: false, // PGT will not increase pregnancy chances
    keyPoint1: false, // PGT-A accuracy and viable embryo discard
    keyPoint2: false, // No sex selection/family balancing
    keyPoint3: false  // Liability waiver
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Single source of truth for consent language — used both for what the signer
  // reads/checks on this page AND what gets embedded in the signed PDF/DB record,
  // so the two can never drift out of sync again.
  const consentContent = getConsentContent()

  useEffect(() => {
    if (token) {
      loadConsent()
    }
  }, [token])

  async function loadConsent() {
    try {
      // Fetch consent record by token
      const { data: consentData, error: consentError } = await supabase
        .from('consents')
        .select(`
          *,
          case:case_id (
            id,
            case_number,
            patient_first_name,
            patient_last_name,
            patient_email,
            partner_first_name,
            partner_last_name,
            partner_email,
            clinic:clinic_id (name)
          )
        `)
        .eq('consent_token', token)
        .single()

      if (consentError || !consentData) {
        setError('Invalid or expired consent link')
        setLoading(false)
        return
      }

      if (consentData.status === 'signed') {
        setError('This consent has already been signed')
        setLoading(false)
        return
      }

      setConsent(consentData)
      setCaseData(consentData.case)
      setLoading(false)
    } catch (err) {
      setError('Failed to load consent')
      setLoading(false)
    }
  }

  function clearSignature() {
    if (sigCanvas.current) {
      sigCanvas.current.clear()
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    
    // Validation - ALL 7 checkboxes must be checked
    if (!checkboxes.readUnderstood || !checkboxes.electronicConsent || !checkboxes.agreeTerms || !checkboxes.insurancePayment || !checkboxes.keyPointPregnancy || !checkboxes.keyPoint1 || !checkboxes.keyPoint2 || !checkboxes.keyPoint3) {
      setError('Please check all required boxes, including all key acknowledgment points')
      return
    }

    if (signatureType === 'typed' && !typedName.trim()) {
      setError('Please enter your full legal name')
      return
    }

    if (signatureType === 'drawn' && sigCanvas.current && sigCanvas.current.isEmpty()) {
      setError('Please provide your signature')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Capture signature data
      const signatureData = signatureType === 'typed' 
        ? typedName 
        : sigCanvas.current.toDataURL()

      // Get IP address
      let ipAddress = ''
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json')
        const ipData = await ipResponse.json()
        ipAddress = ipData.ip
      } catch (e) {
        ipAddress = 'unknown'
      }

      // Update consent record
      const { error: updateError } = await supabase
        .from('consents')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          signature_type: signatureType,
          signature_data: signatureData,
          ip_address: ipAddress,
          metadata: {
            checkboxes: checkboxes,
            keyAcknowledgments: {
              pgtNoPregnancyIncrease: checkboxes.keyPointPregnancy,
              pgtAccuracy: checkboxes.keyPoint1,
              noSexSelection: checkboxes.keyPoint2,
              liabilityWaiver: checkboxes.keyPoint3,
              insurancePayment: checkboxes.insurancePayment
            },
            user_agent: navigator.userAgent,
            signed_at: new Date().toISOString(),
            ip_address: ipAddress
          }
        })
        .eq('consent_token', token)

      if (updateError) {
        throw updateError
      }

      setSubmitting(false)

      // Email the signer their own signed consent copy
      try {
        const signerEmail = consent.signer_email
        const signerFirstName = consent.signer_name?.split(' ')[0] || ''

        if (signerEmail) {
          const signedConsentForPdf = {
            ...consent,
            status: 'signed',
            signed_at: new Date().toISOString(),
            signature_type: signatureType,
            signature_data: signatureData,
            ip_address: ipAddress,
            consent_content: consentContent
          }

          const { base64, fileName } = generateConsentPDF(caseData, consent.signer_type, signedConsentForPdf, true)

          await supabase.functions.invoke('send-signed-consent-copy', {
            body: {
              to: signerEmail,
              firstName: signerFirstName,
              signerType: consent.signer_type,
              caseNumber: caseData.case_number,
              pdfBase64: base64,
              fileName: fileName
            }
          })
        }
      } catch (emailErr) {
        console.error('Failed to email signed consent copy:', emailErr)
        // Non-blocking — signing itself already succeeded, so don't surface this as an error to the signer
      }

      // Check if all consents are now signed and report exists — if so, notify clinic
      try {
        // Fetch the full case with all consents
        const { data: fullCase } = await supabase
          .from('cases')
          .select(`*, consents(id, signer_type, status), clinic:clinics(name)`)
          .eq('id', consent.case_id)
          .single()

        if (fullCase) {
          const patientSigned = fullCase.consents?.find(c => c.signer_type === 'patient')?.status === 'signed'
          const partnerSigned = !fullCase.requires_partner_consent || fullCase.consents?.find(c => c.signer_type === 'partner')?.status === 'signed'

          if (patientSigned && partnerSigned) {
            // All consents signed — auto-update case status
            if (fullCase.status === 'consent_pending') {
              await supabase
                .from('cases')
                .update({ status: 'consent_complete' })
                .eq('id', fullCase.id)
            }

            // If report also exists, notify clinic users
            if (fullCase.report_file_url) {
              const { data: clinicUsers } = await supabase
                .from('users')
                .select('email')
                .eq('clinic_id', fullCase.clinic_id)
                .eq('is_active', true)

              if (clinicUsers?.length > 0) {
                await supabase.functions.invoke('send-report-notification', {
                  body: {
                    emails: clinicUsers.map(u => u.email),
                    case_number: fullCase.case_number,
                    patient_name: `${fullCase.patient_first_name || ''} ${fullCase.patient_last_name || ''}`.trim(),
                    clinic_name: fullCase.clinic?.name || 'Clinic',
                    report_url: fullCase.report_file_url,
                  }
                })
              }
            }
          }
        }
      } catch (notifyErr) {
        console.error('Failed to send report notification after consent:', notifyErr)
      }

      setSuccess(true)
    } catch (err) {
      console.error('Error submitting consent:', err)
      setError('Failed to submit consent. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-ally-teal" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Consent</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">If you believe this is an error, please contact us at lab@allygenetics.com</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Consent Successfully Signed!</h1>
          <p className="text-gray-600 mb-2">Thank you for signing your consent form.</p>
          <p className="text-sm text-gray-500 mb-6">
            Signed on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </p>
          <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-md">
            <p className="font-medium mb-2">What happens next?</p>
            <p>Your signed consent has been recorded and added to your case file. We will begin processing your PGT test request.</p>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            Questions? Contact us at <a href="mailto:lab@allygenetics.com" className="text-ally-teal hover:underline">lab@allygenetics.com</a> or (616) 465-2400
          </p>
        </div>
      </div>
    )
  }

  const signerName = consent.signer_type === 'patient' 
    ? `${caseData.patient_first_name} ${caseData.patient_last_name}`
    : `${caseData.partner_first_name} ${caseData.partner_last_name}`

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="text-center border-b-3 border-ally-teal pb-4 mb-4">
            <h1 className="text-3xl font-bold text-ally-teal">Ally Genetics</h1>
            <p className="text-lg font-semibold text-gray-900 mt-2">Informed Consent for PGT Testing</p>
            <p className="text-sm text-ally-teal mt-1">lab@allygenetics.com | (616) 465-2400</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-semibold">Patient Name:</span> {signerName}
            </div>
            <div>
              <span className="font-semibold">Case Number:</span> {caseData.case_number}
            </div>
            <div>
              <span className="font-semibold">Clinic:</span> {caseData.clinic?.name}
            </div>
            <div>
              <span className="font-semibold">Date:</span> {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Consent Form */}
        <form onSubmit={handleSubmit}>
          {/* Consent Text — rendered directly from getConsentContent(), the same object
              that generates the PDF, so the signer always reads the complete, real
              consent language rather than a shortened summary. */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Consent for Preimplantation Genetic Testing for Aneuploidy (PGT-A)</h2>
            <div className="prose prose-sm max-w-none text-gray-700 max-h-96 overflow-y-auto border border-gray-200 rounded p-4">

              <p className="mb-4"><strong>Introduction</strong></p>
              <p className="mb-4">{consentContent.sections.introduction}</p>

              <p className="mb-4"><strong>Genetic Counseling</strong></p>
              <p className="mb-4">{consentContent.sections.geneticCounseling}</p>

              <p className="mb-4"><strong>Chromosomal Abnormalities</strong></p>
              <p className="mb-4">{consentContent.sections.chromosomalAbnormalities}</p>

              <p className="mb-4"><strong>Benefits of PGT-A</strong></p>
              <p className="mb-4">{consentContent.sections.benefits}</p>

              <p className="mb-4"><strong>Embryo Biopsy Related Risks</strong></p>
              <p className="mb-4">{consentContent.sections.embryoBiopsyRisks}</p>
              <ul className="mb-4 list-disc pl-6">
                {consentContent.sections.embryoBiopsyRisksList.map((risk, i) => (
                  <li key={i}>{risk}</li>
                ))}
              </ul>

              <p className="mb-4"><strong>Fertility Center Related Risks</strong></p>
              <p className="mb-4">There are also risks associated with the clinical process of IVF including:</p>
              <ul className="mb-4 list-disc pl-6">
                {consentContent.sections.fertilityCenterRisks.map((risk, i) => (
                  <li key={i}>{risk}</li>
                ))}
              </ul>

              <p className="mb-4"><strong>Technical and Analytic Risks</strong></p>
              <p className="mb-4">{consentContent.sections.technicalRisks}</p>

              <p className="mb-4"><strong>No Diagnosis</strong></p>
              <p className="mb-4">{consentContent.sections.noDiagnosis}</p>

              <p className="mb-4"><strong>Misdiagnosis</strong></p>
              <p className="mb-4">{consentContent.sections.misdiagnosis}</p>

              <p className="mb-4"><strong>Technical Limits of Detection</strong></p>
              <p className="mb-4">{consentContent.sections.technicalLimits} Ally Genetics PGT-A does not detect the following abnormalities which include but are not limited to:</p>
              <ul className="mb-4 list-disc pl-6">
                {consentContent.sections.technicalLimitsList.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>

              <p className="mb-4"><strong>Follow-Up Recommendation for Prenatal Diagnosis</strong></p>
              <p className="mb-4">{consentContent.sections.followUpRecommendation}</p>

              <p className="mb-4"><strong>Test Results and Interpretation</strong></p>
              <p className="mb-4">{consentContent.sections.testResults.normal}</p>
              <p className="mb-4">{consentContent.sections.testResults.abnormal}</p>
              <ul className="mb-4 list-disc pl-6">
                <li>{consentContent.sections.testResults.trisomy}</li>
                <li>{consentContent.sections.testResults.monosomy}</li>
                <li>{consentContent.sections.testResults.complexAbnormal}</li>
              </ul>
              <p className="mb-4">{consentContent.sections.testResults.noDiagnosis}</p>
              <ul className="mb-4 list-disc pl-6">
                <li>{consentContent.sections.testResults.insufficientDNA}</li>
                <li>{consentContent.sections.testResults.inconclusive}</li>
              </ul>

              <p className="mb-4"><strong>Mosaic Results</strong></p>
              <p className="mb-4">{consentContent.sections.mosaicResults}</p>

              <p className="mb-4"><strong>Alternatives to PGT-A</strong></p>
              <p className="mb-4">{consentContent.sections.alternatives}</p>

              <p className="mb-4"><strong>Costs</strong></p>
              <p className="mb-4">{consentContent.sections.costs}</p>

              <p className="mb-4"><strong>Confidentiality and HIPAA</strong></p>
              <p className="mb-4">{consentContent.sections.confidentiality}</p>

              <p className="mb-4"><strong>Retention of Samples</strong></p>
              <p className="mb-4">{consentContent.sections.retentionOfSamples}</p>

              <p className="mb-4"><strong>By signing below, I attest to the following:</strong></p>
              <ul className="mb-4 list-disc pl-6">
                {consentContent.sections.attestations.map((attestation, i) => (
                  <li key={i}>{attestation}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* KEY ACKNOWLEDGMENT - PGT WILL NOT INCREASE PREGNANCY CHANCES */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{consentContent.warningBoxes.pgtNoPregnancyIncrease.title}</h3>
                <p className="text-gray-800 font-semibold">
                  {consentContent.warningBoxes.pgtNoPregnancyIncrease.text}
                </p>
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer bg-white p-4 rounded border-2 border-yellow-400">
              <input
                type="checkbox"
                checked={checkboxes.keyPointPregnancy}
                onChange={(e) => setCheckboxes(prev => ({ ...prev, keyPointPregnancy: e.target.checked }))}
                className="mt-1 w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
              />
              <span className="text-sm font-semibold text-gray-900">
                ✓ {consentContent.warningBoxes.pgtNoPregnancyIncrease.checkbox}
              </span>
            </label>
          </div>

          {/* KEY ACKNOWLEDGMENT POINT #1 - MUST ACKNOWLEDGE */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{consentContent.warningBoxes.pgtAccuracy.title}</h3>
                <p className="text-gray-800 font-semibold">
                  {consentContent.warningBoxes.pgtAccuracy.text}
                </p>
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer bg-white p-4 rounded border-2 border-yellow-400">
              <input
                type="checkbox"
                checked={checkboxes.keyPoint1}
                onChange={(e) => setCheckboxes(prev => ({ ...prev, keyPoint1: e.target.checked }))}
                className="mt-1 w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
              />
              <span className="text-sm font-semibold text-gray-900">
                ✓ {consentContent.warningBoxes.pgtAccuracy.checkbox}
              </span>
            </label>
          </div>

          {/* KEY ACKNOWLEDGMENT POINT #2 - MUST ACKNOWLEDGE */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{consentContent.warningBoxes.noSexSelection.title}</h3>
                <p className="text-gray-800 font-semibold">
                  {consentContent.warningBoxes.noSexSelection.text}
                </p>
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer bg-white p-4 rounded border-2 border-yellow-400">
              <input
                type="checkbox"
                checked={checkboxes.keyPoint2}
                onChange={(e) => setCheckboxes(prev => ({ ...prev, keyPoint2: e.target.checked }))}
                className="mt-1 w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
              />
              <span className="text-sm font-semibold text-gray-900">
                ✓ {consentContent.warningBoxes.noSexSelection.checkbox}
              </span>
            </label>
          </div>

          {/* KEY ACKNOWLEDGMENT POINT #3 - LIABILITY WAIVER - MUST ACKNOWLEDGE */}
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{consentContent.warningBoxes.liabilityWaiver.title}</h3>
                <p className="text-gray-800 font-semibold">
                  {consentContent.warningBoxes.liabilityWaiver.text}
                </p>
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer bg-white p-4 rounded border-2 border-yellow-400">
              <input
                type="checkbox"
                checked={checkboxes.keyPoint3}
                onChange={(e) => setCheckboxes(prev => ({ ...prev, keyPoint3: e.target.checked }))}
                className="mt-1 w-5 h-5 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
              />
              <span className="text-sm font-semibold text-gray-900">
                ✓ {consentContent.warningBoxes.liabilityWaiver.checkbox}
              </span>
            </label>
          </div>

          {/* Legal Checkboxes */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Required Agreements</h2>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkboxes.readUnderstood}
                  onChange={(e) => setCheckboxes(prev => ({ ...prev, readUnderstood: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-ally-teal border-gray-300 rounded focus:ring-ally-teal"
                />
                <span className="text-sm text-gray-700">
                  {consentContent.requiredAgreements[0]}
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkboxes.electronicConsent}
                  onChange={(e) => setCheckboxes(prev => ({ ...prev, electronicConsent: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-ally-teal border-gray-300 rounded focus:ring-ally-teal"
                />
                <span className="text-sm text-gray-700">
                  {consentContent.requiredAgreements[1]}
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkboxes.agreeTerms}
                  onChange={(e) => setCheckboxes(prev => ({ ...prev, agreeTerms: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-ally-teal border-gray-300 rounded focus:ring-ally-teal"
                />
                <span className="text-sm text-gray-700">
                  {consentContent.requiredAgreements[2]}
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkboxes.insurancePayment}
                  onChange={(e) => setCheckboxes(prev => ({ ...prev, insurancePayment: e.target.checked }))}
                  className="mt-1 w-4 h-4 text-ally-teal border-gray-300 rounded focus:ring-ally-teal"
                />
                <span className="text-sm text-gray-700">
                  {consentContent.requiredAgreements[3]}
                </span>
              </label>
            </div>
          </div>

          {/* My Signature Below Indicates — same attestation list embedded in the PDF's
              signature page, now shown here too so nothing is signed "sight unseen." */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My signature below indicates that:</h2>
            <ol className="space-y-2 list-decimal pl-5 text-sm text-gray-700">
              {consentContent.signatureAttestations.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ol>
          </div>

          {/* Signature Section */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Signature</h2>
            
            {/* Signature Type Selector */}
            <div className="flex gap-4 mb-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="typed"
                  checked={signatureType === 'typed'}
                  onChange={() => setSignatureType('typed')}
                  className="w-4 h-4 text-ally-teal focus:ring-ally-teal"
                />
                <span className="text-sm font-medium">Type Name</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="drawn"
                  checked={signatureType === 'drawn'}
                  onChange={() => setSignatureType('drawn')}
                  className="w-4 h-4 text-ally-teal focus:ring-ally-teal"
                />
                <span className="text-sm font-medium">Draw Signature</span>
              </label>
            </div>

            {/* Typed Signature */}
            {signatureType === 'typed' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type your full legal name:
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal text-lg font-serif italic"
                />
              </div>
            )}

            {/* Drawn Signature */}
            {signatureType === 'drawn' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Draw your signature below:
                </label>
                <div className="border-2 border-gray-300 rounded-md bg-white">
                  <SignatureCanvas
                    ref={sigCanvas}
                    canvasProps={{
                      className: 'w-full h-40 cursor-crosshair'
                    }}
                    backgroundColor="white"
                  />
                </div>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="mt-2 text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Clear Signature
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  Note: You need to install react-signature-canvas package for signature drawing to work
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-ally-teal text-white py-4 px-6 rounded-md font-semibold text-lg hover:bg-ally-teal-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-5 h-5 animate-spin" />}
              {submitting ? 'Submitting...' : 'Sign and Submit Consent'}
            </button>
            <p className="text-xs text-center text-gray-500 mt-4">
              By clicking this button, you are providing your legally binding electronic signature
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// ADMIN KIT ORDERS PAGE
// ============================================================================
function KitOrdersPage() {
  const { supabase } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    setLoading(true)
    const { data, error } = await supabase
      .from('kit_orders')
      .select('*, clinic:clinics(name), ordered_by:users(first_name, last_name, email)')
      .order('created_at', { ascending: false })
    
    if (!error && data) {
      setOrders(data)
    }
    setLoading(false)
  }

  async function updateOrderStatus(orderId, newStatus) {
    await supabase
      .from('kit_orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId)
    
    fetchOrders()
  }

  async function updateTrackingNumber(orderId, trackingNumber) {
    await supabase
      .from('kit_orders')
      .update({ fedex_tracking: trackingNumber, updated_at: new Date().toISOString() })
      .eq('id', orderId)
    
    fetchOrders()
  }

  // Filter by status and search term
  const filteredOrders = orders.filter(o => {
    const matchesStatus = filter === 'all' || o.status === filter
    const matchesSearch = !searchTerm || 
      o.clinic?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.fedex_tracking?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.id?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    fulfilled: 'bg-blue-100 text-blue-800',
    shipped: 'bg-green-100 text-green-800'
  }

  const statusCounts = {
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    fulfilled: orders.filter(o => o.status === 'fulfilled').length,
    shipped: orders.filter(o => o.status === 'shipped').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-ally-teal" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kit Orders</h1>
          <p className="text-gray-600 mt-1">Manage supply orders from clinics</p>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2 border-b">
          {['all', 'pending', 'fulfilled', 'shipped'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                filter === status 
                  ? 'border-ally-teal text-ally-teal' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
                {statusCounts[status]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clinic or FedEx #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ally-teal w-64"
          />
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No orders found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <div key={order.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      Order #{order.id?.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                    {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <input
                      type="text"
                      placeholder="FedEx Tracking #"
                      defaultValue={order.fedex_tracking || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (order.fedex_tracking || '')) {
                          updateTrackingNumber(order.id, e.target.value)
                        }
                      }}
                      className="text-sm border border-gray-300 rounded-md px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-ally-teal"
                    />
                  </div>
                  <select
                    value={order.status}
                    onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ally-teal"
                  >
                    <option value="pending">Pending</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="shipped">Shipped</option>
                  </select>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-3 gap-6">
                {/* Clinic Info */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Clinic</h4>
                  <p className="font-medium text-gray-900">{order.clinic?.name || 'Unknown Clinic'}</p>
                  <p className="text-sm text-gray-600">
                    Ordered by: {order.ordered_by?.first_name} {order.ordered_by?.last_name}
                  </p>
                  <p className="text-sm text-gray-600">{order.ordered_by?.email}</p>
                </div>

                {/* Items Ordered */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Items Ordered</h4>
                  <div className="text-sm space-y-1">
                    {order.items?.complete_kits > 0 && (
                      <p className="text-gray-900">Complete Kits: <span className="font-medium">{order.items.complete_kits}</span></p>
                    )}
                    {order.items?.biopsy_collection_kits > 0 && (
                      <p className="text-gray-900">Patient Sample Racks: <span className="font-medium">{order.items.biopsy_collection_kits}</span></p>
                    )}
                    {order.items?.shipping_containers > 0 && (
                      <p className="text-gray-900">Shipping Containers: <span className="font-medium">{order.items.shipping_containers}</span></p>
                    )}
                    {order.items?.collection_tubes > 0 && (
                      <p className="text-gray-900">Collection Tubes: <span className="font-medium">{order.items.collection_tubes}</span></p>
                    )}
                    {order.items?.collection_buffer > 0 && (
                      <p className="text-gray-900">Collection Buffer (400µL aliquots): <span className="font-medium">{order.items.collection_buffer}</span></p>
                    )}
                    {order.items?.fedex_labels > 0 && (
                      <p className="text-gray-900">UPS Labels: <span className="font-medium">{order.items.fedex_labels}</span></p>
                    )}
                    {order.items?.ice_packs > 0 && (
                      <p className="text-gray-900">Cryo Packs: <span className="font-medium">{order.items.ice_packs}</span></p>
                    )}
                  </div>
                  {order.delivery_by && (
                    <p className="text-sm text-amber-700 mt-2 font-medium">
                      Delivery By: {new Date(order.delivery_by + 'T00:00:00').toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Shipping Address */}
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Ship To</h4>
                  <p className="text-sm text-gray-900 whitespace-pre-line">
                    {order.shipping_address || 'No address provided - use clinic default'}
                  </p>
                  {order.notes && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-500 mb-1">Notes</h4>
                      <p className="text-sm text-gray-600">{order.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// BULK IMPORT PAGE (Admin Only)
// ============================================================================
function BulkImportPage() {
  const { supabase } = useAuth()
  const [files, setFiles] = useState([])
  const [fileData, setFileData] = useState({}) // Manual overrides for each file
  const [clinics, setClinics] = useState([])
  const [selectedClinic, setSelectedClinic] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState([])
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    fetchClinics()
  }, [])

  async function fetchClinics() {
    const { data } = await supabase.from('clinics').select('id, name').order('name')
    setClinics(data || [])
  }

  function handleFileSelect(e) {
    const selectedFiles = Array.from(e.target.files).filter(f => f.name.endsWith('.pdf'))
    setFiles(selectedFiles)
    
    // Initialize fileData with parsed values or empty
    const initialData = {}
    selectedFiles.forEach((file, idx) => {
      const parsed = parseFilename(file.name)
      initialData[idx] = {
        firstName: parsed?.firstName || '',
        lastName: parsed?.lastName || '',
        reportDate: parsed?.reportDate || new Date().toISOString().split('T')[0]
      }
    })
    setFileData(initialData)
    setResults([])
    setCompleted(false)
  }

  function parseFilename(filename) {
    // Format: "LastName, FirstName YYYY-MM-DD.pdf"
    const match = filename.match(/^(.+),\s*(.+)\s+(\d{4}-\d{2}-\d{2})\.pdf$/i)
    if (match) {
      return {
        lastName: match[1].trim(),
        firstName: match[2].trim(),
        reportDate: match[3]
      }
    }
    return null
  }

  function updateFileData(idx, field, value) {
    setFileData(prev => ({
      ...prev,
      [idx]: { ...prev[idx], [field]: value }
    }))
  }

  async function generateCaseNumber() {
    const year = new Date().getFullYear()
    const { data } = await supabase
      .from('cases')
      .select('case_number')
      .like('case_number', `AG-${year}-%`)
      .order('case_number', { ascending: false })
      .limit(1)
    
    let nextNum = 1
    if (data && data.length > 0) {
      const lastNum = parseInt(data[0].case_number.split('-')[2])
      nextNum = lastNum + 1
    }
    return `AG-${year}-${String(nextNum).padStart(4, '0')}`
  }

  async function handleImport() {
    if (!selectedClinic || files.length === 0) {
      alert('Please select a clinic and upload PDF files')
      return
    }

    // Validate all files have names
    for (let i = 0; i < files.length; i++) {
      if (!fileData[i]?.firstName || !fileData[i]?.lastName) {
        alert(`Please enter first and last name for: ${files[i].name}`)
        return
      }
    }

    setImporting(true)
    setProgress({ current: 0, total: files.length })
    const importResults = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const data = fileData[i]
      setProgress({ current: i + 1, total: files.length })

      try {
        // Generate case number
        const caseNumber = await generateCaseNumber()

        // Create case (status = completed, no emails sent)
        const { data: newCase, error: caseError } = await supabase
          .from('cases')
          .insert({
            case_number: caseNumber,
            clinic_id: selectedClinic,
            patient_first_name: data.firstName,
            patient_last_name: data.lastName,
            patient_dob: '1900-01-01', // Placeholder DOB
            test_type: 'pgt_a',
            status: 'completed',
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (caseError) throw caseError

        // Upload report to storage
        const filePath = `reports/${selectedClinic}/${caseNumber}_report_${Date.now()}.pdf`
        const { error: uploadError } = await supabase.storage
          .from('case-documents')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('case-documents')
          .getPublicUrl(filePath)

        // Update case with report URL
        await supabase
          .from('cases')
          .update({
            report_file_url: urlData.publicUrl,
            report_file_name: file.name,
            report_uploaded_at: data.reportDate + 'T00:00:00Z'
          })
          .eq('id', newCase.id)

        importResults.push({ 
          filename: file.name, 
          status: 'success', 
          message: `Created ${caseNumber}`,
          caseNumber 
        })

      } catch (err) {
        importResults.push({ filename: file.name, status: 'error', message: err.message })
      }
    }

    setResults(importResults)
    setImporting(false)
    setCompleted(true)
  }

  const successCount = results.filter(r => r.status === 'success').length
  const errorCount = results.filter(r => r.status === 'error').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Import Reports</h1>
        <p className="text-gray-600 mt-1">Import historical reports and create cases automatically</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">How it works</h3>
          <p className="text-blue-800 text-sm">
            Upload PDF reports and we'll try to parse patient names from filenames. You can edit any name before importing.
          </p>
          <p className="text-blue-700 text-sm mt-1">
            Auto-parse format: <code className="bg-blue-100 px-1 rounded">LastName, FirstName YYYY-MM-DD.pdf</code>
          </p>
        </div>

        {/* Clinic Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Clinic</label>
          <select
            value={selectedClinic}
            onChange={(e) => setSelectedClinic(e.target.value)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            disabled={importing}
          >
            <option value="">-- Select Clinic --</option>
            {clinics.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Upload PDF Reports</label>
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileSelect}
            disabled={importing}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-ally-teal file:text-white hover:file:bg-ally-teal-dark"
          />
          {files.length > 0 && (
            <p className="mt-2 text-sm text-gray-600">{files.length} PDF file(s) selected</p>
          )}
        </div>

        {/* File List with Editable Names */}
        {files.length > 0 && !completed && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Review & Edit Patient Names:</h3>
            <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
              {files.map((file, idx) => {
                const parsed = parseFilename(file.name)
                const data = fileData[idx] || {}
                const isValid = data.firstName && data.lastName
                return (
                  <div key={idx} className={`p-3 ${!isValid ? 'bg-yellow-50' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 truncate max-w-xs">{file.name}</span>
                      {parsed ? (
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">Auto-parsed</span>
                      ) : (
                        <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded">Manual entry</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="First Name *"
                        value={data.firstName || ''}
                        onChange={(e) => updateFileData(idx, 'firstName', e.target.value)}
                        disabled={importing}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ally-teal"
                      />
                      <input
                        type="text"
                        placeholder="Last Name *"
                        value={data.lastName || ''}
                        onChange={(e) => updateFileData(idx, 'lastName', e.target.value)}
                        disabled={importing}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ally-teal"
                      />
                      <input
                        type="date"
                        value={data.reportDate || ''}
                        onChange={(e) => updateFileData(idx, 'reportDate', e.target.value)}
                        disabled={importing}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-ally-teal"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Progress */}
        {importing && (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-ally-teal" />
              <span className="text-gray-700">Importing {progress.current} of {progress.total}...</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-ally-teal h-2 rounded-full transition-all"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {completed && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <p className="text-green-800 font-medium">{successCount} Imported Successfully</p>
              </div>
              {errorCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-red-800 font-medium">{errorCount} Errors</p>
                </div>
              )}
            </div>
            
            <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
              {results.map((result, idx) => (
                <div key={idx} className={`px-3 py-2 text-sm flex items-center justify-between ${result.status === 'error' ? 'bg-red-50' : ''}`}>
                  <span className="text-gray-900">{result.filename}</span>
                  <span className={result.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                    {result.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Import Button */}
        {!completed && (
          <button
            onClick={handleImport}
            disabled={importing || !selectedClinic || files.length === 0}
            className="bg-ally-teal text-white px-6 py-2 rounded-md hover:bg-ally-teal-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import {files.length} Report{files.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        )}

        {/* Reset */}
        {completed && (
          <button
            onClick={() => { setFiles([]); setFileData({}); setResults([]); setCompleted(false); }}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-200"
          >
            Import More
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// RESET PASSWORD PAGE
// ============================================================================
function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [verified, setVerified] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [codeEmail, setCodeEmail] = useState('')
  const [code, setCode] = useState('')
  const navigate = useNavigate()
  const { supabase } = useAuth()

  useEffect(() => {
    // If the user arrived via a still-intact link (rare, since email
    // security scanners tend to burn single-use link tokens before a real
    // user clicks), auto-verify it. Otherwise the user falls through to
    // the manual 6-digit code form below, which is immune to link
    // scanners since it's never a clickable URL.
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const hashType = hashParams.get('type')

    if (accessToken && refreshToken && hashType === 'recovery') {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ error }) => {
        if (!error) setVerified(true)
      })
      return
    }

    const queryParams = new URLSearchParams(window.location.search)
    const tokenHash = queryParams.get('token_hash')
    const queryType = queryParams.get('type')

    if (tokenHash && queryType === 'recovery') {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }).then(({ error }) => {
        if (!error) setVerified(true)
      })
    }
  }, [])

  async function handleVerifyCode(e) {
    e.preventDefault()
    setError(null)
    setVerifying(true)

    const { error } = await supabase.auth.verifyOtp({
      email: codeEmail,
      token: code,
      type: 'recovery'
    })

    if (error) {
      setError(error.message || 'That code is invalid or has expired. Please request a new one.')
      setVerifying(false)
    } else {
      setVerified(true)
      setVerifying(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      // Sign out and redirect to login after 3 seconds
      setTimeout(async () => {
        await supabase.auth.signOut()
        navigate('/login')
      }, 3000)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <DNAHelixLogo size={64} />
            </div>
            <h1 className="text-2xl font-bold text-ally-navy">Ally Genetics Portal</h1>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Password Updated!</h2>
            <p className="text-gray-600 mb-4">
              Your password has been successfully changed. Redirecting to login...
            </p>
            <Loader2 className="w-6 h-6 animate-spin text-ally-teal mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <DNAHelixLogo size={64} />
          </div>
          <h1 className="text-2xl font-bold text-ally-navy">Ally Genetics Portal</h1>
          <p className="text-gray-500 mt-2">Set your new password</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800 mb-4">
              {error}
            </div>
          )}

          {!verified ? (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <p className="text-sm text-gray-600">
                Enter your email and the 6-digit code from the password reset email.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={codeEmail}
                  onChange={(e) => setCodeEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal focus:border-transparent"
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">6-digit code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal focus:border-transparent"
                  placeholder="123456"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={verifying}
                className="w-full bg-ally-teal text-white py-2 px-4 rounded-md hover:bg-ally-teal-dark transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {verifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Verify Code
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal focus:border-transparent"
                  placeholder="Enter new password"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal focus:border-transparent"
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-ally-teal text-white py-2 px-4 rounded-md hover:bg-ally-teal-dark transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Update Password
              </button>
            </form>
          )}

          <div className="text-center mt-4">
            <Link to="/login" className="text-sm text-gray-600 hover:text-ally-teal">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// PLACEHOLDER PAGES
// ============================================================================
function PlaceholderPage({ title }) {
  return (
    <div className="text-center py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500">This page is under construction.</p>
    </div>
  )
}

// ============================================================================
// MAIN APP
// ============================================================================
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          
          {/* Public Consent Signing Route - No Auth Required */}
          <Route path="/consent/:token" element={<ConsentSigningPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin" element={<Navigate to="/admin/cases" replace />} />
          <Route path="/admin/cases" element={<ProtectedRoute adminOnly><AdminLayout><AllCasesPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/cases/:id" element={<ProtectedRoute adminOnly><AdminLayout><CaseDetailsPage isAdmin={true} /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/clinics" element={<ProtectedRoute adminOnly><AdminLayout><ClinicsPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute adminOnly><AdminLayout><KitOrdersPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/import" element={<ProtectedRoute adminOnly><AdminLayout><BulkImportPage /></AdminLayout></ProtectedRoute>} />
          
          {/* Clinic Routes */}
          <Route path="/clinic" element={<ProtectedRoute><ClinicLayout><ClinicDashboard /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/stats" element={<ProtectedRoute><ClinicLayout><LabStatisticsPage /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/cases" element={<ProtectedRoute><ClinicLayout><ClinicCasesPage /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/cases/new" element={<ProtectedRoute><ClinicLayout><NewRequisitionPage /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/cases/:id" element={<ProtectedRoute><ClinicLayout><CaseDetailsPage isAdmin={false} /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/worksheet" element={<ProtectedRoute><ClinicLayout><PlaceholderPage title="Biopsy Worksheet" /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/orders" element={<ProtectedRoute><ClinicLayout><OrderSuppliesPage /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/contact" element={<ProtectedRoute><ClinicLayout><ContactUsPage /></ClinicLayout></ProtectedRoute>} />
          
          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
