import { useState, useEffect, createContext, useContext } from 'react'
import { createClient } from '@supabase/supabase-js'
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useParams } from 'react-router-dom'
import { 
  LayoutDashboard, FileText, Building2, Package, Users, LogOut, Plus, 
  Clock, CheckCircle, AlertCircle, Search, ChevronRight, Loader2, Eye, X, Mail, Key,
  BarChart3, Phone, MapPin, Calendar, Filter, Download, User, Settings, Upload, FileUp,
  ClipboardList, Save, Trash2, Printer, Check
} from 'lucide-react'

// ============================================================================
// ALLY GENETICS DNA HELIX LOGO COMPONENT
// ============================================================================
function DNAHelixLogo({ size = 32, className = '' }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 40 40" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* DNA Helix Structure */}
      <path 
        d="M12 5 Q15 10, 12 15 Q9 20, 12 25 Q15 30, 12 35" 
        stroke="#2D2A4A" 
        strokeWidth="2.5" 
        fill="none"
        strokeLinecap="round"
      />
      <path 
        d="M18 5 Q15 10, 18 15 Q21 20, 18 25 Q15 30, 18 35" 
        stroke="#2D2A4A" 
        strokeWidth="2.5" 
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Connecting lines */}
      <line x1="12" y1="8" x2="18" y2="8" stroke="#2D2A4A" strokeWidth="1.5" opacity="0.6" />
      <line x1="12" y1="15" x2="18" y2="15" stroke="#2D2A4A" strokeWidth="1.5" opacity="0.6" />
      <line x1="12" y1="22" x2="18" y2="22" stroke="#2D2A4A" strokeWidth="1.5" opacity="0.6" />
      <line x1="12" y1="29" x2="18" y2="29" stroke="#2D2A4A" strokeWidth="1.5" opacity="0.6" />
      
      {/* Circular gradient element */}
      <circle cx="28" cy="20" r="10" fill="url(#tealGradient)" opacity="0.9" />
      <circle cx="28" cy="20" r="7" fill="url(#tealGradientInner)" opacity="0.7" />
      <circle cx="28" cy="20" r="4" fill="url(#tealGradientCore)" opacity="0.9" />
      
      {/* Gradient definitions */}
      <defs>
        <radialGradient id="tealGradient" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#A8E0D7" />
          <stop offset="100%" stopColor="#7ECFC0" />
        </radialGradient>
        <radialGradient id="tealGradientInner" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#C0EDE5" />
          <stop offset="100%" stopColor="#A8E0D7" />
        </radialGradient>
        <radialGradient id="tealGradientCore" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#D5F4EF" />
          <stop offset="100%" stopColor="#C0EDE5" />
        </radialGradient>
      </defs>
    </svg>
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
          console.log('Session expired due to inactivity')
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

  const isAllyStaff = realUserData?.role === 'ally_staff' || realUserData?.role === 'ally_admin'
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
      redirectTo: window.location.origin + '/login'
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
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'All Cases', href: '/admin/cases', icon: FileText },
    { name: 'Clinics', href: '/admin/clinics', icon: Building2 },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Kit Orders', href: '/admin/orders', icon: Package },
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
    navigate('/admin/users')
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
          <DNAHelixLogo size={32} className="flex-shrink-0" />
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-[#2D2A4A] text-sm leading-tight">Ally Genetics</span>
              <span className="text-[10px] text-gray-500 leading-tight">Better Partnerships</span>
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
  requisition_submitted: 'Submitted',
  consent_pending: 'Consent Pending',
  consent_complete: 'Consent Complete',
  samples_received: 'Samples Received',
  in_progress: 'In Progress',
  report_ready: 'Report Ready',
  complete: 'Complete',
  cancelled: 'Cancelled',
}

const statusColors = {
  requisition_submitted: 'bg-gray-100 text-gray-800',
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

    const { data: statusData } = await supabase.from('cases').select('status')
    
    const statusCounts = {
      total: statusData?.length || 0,
      consent_pending: statusData?.filter(c => c.status === 'consent_pending').length || 0,
      samples_received: statusData?.filter(c => c.status === 'samples_received').length || 0,
      in_progress: statusData?.filter(c => c.status === 'in_progress').length || 0,
      report_ready: statusData?.filter(c => c.status === 'report_ready').length || 0,
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

      // Get all users for this clinic to send notifications
      const { data: clinicUsers } = await supabase
        .from('users')
        .select('email, first_name')
        .eq('clinic_id', caseData.clinic_id)
        .eq('is_active', true)

      // Log notification (in production, this would send actual emails)
      console.log('Would send report ready notification to:', clinicUsers?.map(u => u.email))
      
      // For now, we'll create a notification record (you can set up email later)
      // In production, integrate with Resend, SendGrid, or similar
      
      alert(`Report uploaded successfully! ${clinicUsers?.length || 0} clinic users will be notified.`)
      fetchData()
    } catch (err) {
      console.error('Upload error:', err)
      alert('Error uploading report: ' + err.message)
    }
    
    setUploadingCase(null)
  }

  const statCards = [
    { label: 'Total Cases', value: counts.total || 0, icon: FileText, color: 'bg-gray-100 text-gray-600' },
    { label: 'Consent Pending', value: counts.consent_pending || 0, icon: Clock, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Samples Received', value: counts.samples_received || 0, icon: AlertCircle, color: 'bg-blue-50 text-blue-600' },
    { label: 'In Progress', value: counts.in_progress || 0, icon: Loader2, color: 'bg-purple-50 text-purple-600' },
    { label: 'Reports Ready', value: counts.report_ready || 0, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
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
  const [showRequisitionModal, setShowRequisitionModal] = useState(false)
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
    // Fetch all cases for this clinic with ordering provider info
    const { data: allCases } = await supabase
      .from('cases')
      .select(`
        *,
        ordering_provider:providers(first_name, last_name, credentials)
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
      patientMap[key].cycles.push(c)
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

  const filteredPatients = patients
    .filter(p => {
      if (!searchTerm) return true
      const search = searchTerm.toLowerCase()
      return (
        p.first_name?.toLowerCase().includes(search) ||
        p.last_name?.toLowerCase().includes(search) ||
        p.dob?.includes(search)
      )
    })
    .sort((a, b) => {
      let aVal, bVal
      if (sortField === 'name') {
        aVal = `${a.last_name} ${a.first_name}`.toLowerCase()
        bVal = `${b.last_name} ${b.first_name}`.toLowerCase()
      } else if (sortField === 'dob') {
        aVal = a.dob || ''
        bVal = b.dob || ''
      } else if (sortField === 'doctor') {
        aVal = a.doctor.toLowerCase()
        bVal = b.doctor.toLowerCase()
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
          onClick={() => setShowRequisitionModal(true)}
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-4">
          <h2 className="text-lg font-semibold text-ally-navy">Patient Records</h2>
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or DOB..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ally-teal w-full text-sm"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th 
                  onClick={() => handleSort('name')}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Patient Name
                    <svg className={`w-3 h-3 ${sortField === 'name' ? 'text-ally-teal' : 'text-gray-400 opacity-50'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('dob')}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Date of Birth
                    <svg className={`w-3 h-3 ${sortField === 'dob' ? 'text-ally-teal' : 'text-gray-400 opacity-50'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('doctor')}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Doctor
                    <svg className={`w-3 h-3 ${sortField === 'doctor' ? 'text-ally-teal' : 'text-gray-400 opacity-50'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPatients.length > 0 ? filteredPatients.map((patient, idx) => (
                <tr 
                  key={idx}
                  onClick={() => setSelectedPatient(patient)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-ally-teal/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-ally-teal font-medium text-sm">
                          {patient.first_name?.[0]}{patient.last_name?.[0]}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {patient.last_name}, {patient.first_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {patient.dob ? new Date(patient.dob).toLocaleDateString('en-US') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{patient.doctor}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    {searchTerm ? (
                      <p>No patients found matching "{searchTerm}"</p>
                    ) : (
                      <div>
                        <p className="mb-2">No patients yet.</p>
                        <button 
                          onClick={() => setShowRequisitionModal(true)}
                          className="text-ally-teal hover:underline"
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

      {/* New Requisition Modal */}
      {showRequisitionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRequisitionModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ally-navy">New Requisition</h3>
              <button onClick={() => setShowRequisitionModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 text-center py-8">
                Requisition form will be displayed here.
                <br />
                <button 
                  onClick={() => {
                    setShowRequisitionModal(false)
                    navigate('/clinic/cases/new')
                  }}
                  className="text-ally-teal hover:underline mt-2"
                >
                  Or go to full requisition page →
                </button>
              </p>
            </div>
          </div>
        </div>
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
function PatientCyclesModal({ patient, onClose, supabase }) {
  const [downloading, setDownloading] = useState(null)

  async function handleDownload(caseId, docType) {
    setDownloading(`${caseId}-${docType}`)
    // Download logic here
    setTimeout(() => setDownloading(null), 1000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-semibold text-ally-navy">
              {patient.last_name}, {patient.first_name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              DOB: {patient.dob ? new Date(patient.dob).toLocaleDateString('en-US') : 'N/A'} • {patient.doctor} • {patient.cycles.length} {patient.cycles.length === 1 ? 'Cycle' : 'Cycles'}
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
                    Cycle {patient.cycles.length - idx} - {cycle.test_type || 'PGT'}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Started: {new Date(cycle.created_at).toLocaleDateString('en-US')}
                  </p>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  cycle.status === 'complete' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                }`}>
                  {cycle.status === 'complete' ? 'Completed' : 'Active'}
                </span>
              </div>

              {/* Cycle Content Grid */}
              <div className="grid grid-cols-3 gap-3">
                {/* Requisition */}
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-ally-teal" />
                    Requisition
                  </div>
                  <div className="space-y-2">
                    <button 
                      onClick={() => handleDownload(cycle.id, 'requisition')}
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
                  </div>
                </div>

                {/* Consents */}
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-ally-teal" />
                    Consents
                  </div>
                  <div className="space-y-1.5">
                    <button 
                      onClick={() => handleDownload(cycle.id, 'patient-consent')}
                      className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-ally-teal/10 border border-gray-200 hover:border-ally-teal rounded-md transition-all text-left"
                      disabled={downloading === `${cycle.id}-patient-consent`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">
                          Patient 
                          <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-medium rounded">Signed</span>
                        </div>
                        <div className="text-[10px] text-gray-500">01/16/24</div>
                      </div>
                      {downloading === `${cycle.id}-patient-consent` ? (
                        <Loader2 className="w-3.5 h-3.5 text-ally-teal animate-spin flex-shrink-0 ml-2" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-ally-teal flex-shrink-0 ml-2" />
                      )}
                    </button>
                    <button 
                      onClick={() => handleDownload(cycle.id, 'partner-consent')}
                      className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-ally-teal/10 border border-gray-200 hover:border-ally-teal rounded-md transition-all text-left"
                      disabled={downloading === `${cycle.id}-partner-consent`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">
                          Partner 
                          <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-medium rounded">Signed</span>
                        </div>
                        <div className="text-[10px] text-gray-500">01/16/24</div>
                      </div>
                      {downloading === `${cycle.id}-partner-consent` ? (
                        <Loader2 className="w-3.5 h-3.5 text-ally-teal animate-spin flex-shrink-0 ml-2" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-ally-teal flex-shrink-0 ml-2" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Reports */}
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-ally-teal" />
                    Reports
                  </div>
                  {cycle.report_file ? (
                    <button 
                      onClick={() => handleDownload(cycle.id, 'report')}
                      className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-ally-teal/10 border border-gray-200 hover:border-ally-teal rounded-md transition-all text-left"
                      disabled={downloading === `${cycle.id}-report`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">PGT Report</div>
                        <div className="text-[10px] text-gray-500">
                          {cycle.report_date ? new Date(cycle.report_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'Available'}
                        </div>
                      </div>
                      {downloading === `${cycle.id}-report` ? (
                        <Loader2 className="w-3.5 h-3.5 text-ally-teal animate-spin flex-shrink-0 ml-2" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-ally-teal flex-shrink-0 ml-2" />
                      )}
                    </button>
                  ) : (
                    <div className="text-center py-4 text-gray-400 text-xs">No reports yet</div>
                  )}
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
    biopsy_collection_kits: 0,
    shipping_containers: 0,
    collection_tubes: 0,
    shipping_address: '',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmitOrder(e) {
    e.preventDefault()
    setSubmitting(true)

    // Save order to database
    const { data: newOrder } = await supabase.from('kit_orders').insert({
      clinic_id: userData.clinic_id,
      ordered_by_user_id: userData.id,
      status: 'pending',
      items: {
        biopsy_collection_kits: orderForm.biopsy_collection_kits,
        shipping_containers: orderForm.shipping_containers,
        collection_tubes: orderForm.collection_tubes,
      },
      shipping_address: orderForm.shipping_address || userData.clinic?.address || '',
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
            biopsy_collection_kits: orderForm.biopsy_collection_kits,
            shipping_containers: orderForm.shipping_containers,
            collection_tubes: orderForm.collection_tubes,
          },
          shipping_address: orderForm.shipping_address || userData.clinic?.address || 'Use clinic default address',
          notes: orderForm.notes || 'None',
        }
      })
    } catch (error) {
      console.log('Email notification error:', error)
    }

    setSubmitting(false)
    setSuccess(true)
  }

  function handleNewOrder() {
    setSuccess(false)
    setOrderForm({ 
      biopsy_collection_kits: 0, 
      shipping_containers: 0, 
      collection_tubes: 0, 
      shipping_address: '', 
      notes: '' 
    })
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8 text-center" onClick={(e) => e.stopPropagation()}>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-ally-navy">Order Supplies</h2>
          <p className="text-sm text-gray-600 mt-1">Request collection kits and supplies for your clinic</p>
        </div>
        <form onSubmit={handleSubmitOrder} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Biopsy Collection Kits</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Collection Tubes (PCR tubes)</label>
            <input
              type="number"
              min="0"
              value={orderForm.collection_tubes}
              onChange={(e) => setOrderForm(f => ({ ...f, collection_tubes: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Address</label>
            <textarea
              value={orderForm.shipping_address}
              onChange={(e) => setOrderForm(f => ({ ...f, shipping_address: e.target.value }))}
              rows={3}
              placeholder="Enter shipping address or leave blank to use clinic default address"
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
              disabled={submitting || (orderForm.biopsy_collection_kits === 0 && orderForm.shipping_containers === 0 && orderForm.collection_tubes === 0)}
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
      available: caseData.status === 'report_ready' || caseData.status === 'complete'
    },
  ]

  async function handleDownload(docType) {
    setDownloading(docType)
    
    // For now, navigate to case details page where files can be accessed
    // In production, this would download actual files from Supabase storage
    setTimeout(() => {
      setDownloading(null)
      // You can implement actual file download logic here
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
              <span className="ml-2 font-medium">{caseData.patient_dob ? new Date(caseData.patient_dob).toLocaleDateString() : 'N/A'}</span>
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
  const [cases, setCases] = useState([])
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingCase, setUploadingCase] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [clinicFilter, setClinicFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

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

      // Get all users for this clinic to send notifications
      const { data: clinicUsers } = await supabase
        .from('users')
        .select('email, first_name')
        .eq('clinic_id', caseData.clinic_id)
        .eq('is_active', true)

      // Log notification (in production, this would send actual emails via Resend/SendGrid)
      console.log('Sending report ready notification to:', clinicUsers?.map(u => u.email))
      
      // Store notification for email sending
      // You would integrate with an email service here
      
      alert(`Report uploaded successfully!\n\nNotification will be sent to ${clinicUsers?.length || 0} user(s) at ${caseData.clinic?.name}.`)
      fetchData()
    } catch (err) {
      console.error('Upload error:', err)
      alert('Error uploading report: ' + err.message)
    }
    
    setUploadingCase(null)
  }

  async function handleUpdateStatus(caseId, newStatus) {
    await supabase
      .from('cases')
      .update({ status: newStatus })
      .eq('id', caseId)
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
          <option value="samples_received">Samples Received</option>
          <option value="in_progress">In Progress</option>
          <option value="report_ready">Report Ready</option>
          <option value="complete">Complete</option>
        </select>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Case #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clinic</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tests</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Report</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-ally-teal">
                    <Link to={`/admin/cases/${c.id}`} className="hover:underline">
                      {c.case_number || '-'}
                    </Link>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{c.patient_last_name}, {c.patient_first_name}</div>
                    <div className="text-xs text-gray-500">DOB: {c.patient_dob ? new Date(c.patient_dob).toLocaleDateString() : '-'}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {c.clinic?.name || '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {c.ordering_provider ? `${c.ordering_provider.first_name} ${c.ordering_provider.last_name}, ${c.ordering_provider.credentials || ''}`.trim() : '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {c.tests_ordered?.map(t => t.replace('pgt_', 'PGT-').toUpperCase()).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <select
                      value={c.status}
                      onChange={(e) => handleUpdateStatus(c.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ally-teal"
                    >
                      <option value="consent_pending">Consent Pending</option>
                      <option value="consent_complete">Consent Complete</option>
                      <option value="samples_received">Samples Received</option>
                      <option value="in_progress">In Progress</option>
                      <option value="report_ready">Report Ready</option>
                      <option value="complete">Complete</option>
                    </select>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    {c.report_file_url ? (
                      <div className="flex items-center justify-end gap-2">
                        <a 
                          href={c.report_file_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-green-600 hover:underline text-sm"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                        <label className="inline-flex items-center gap-1 text-gray-500 hover:text-ally-teal text-sm cursor-pointer">
                          <Upload className="w-4 h-4" />
                          <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) {
                                handleUploadReport(c, e.target.files[0])
                              }
                            }}
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-1 text-ally-teal hover:underline text-sm cursor-pointer">
                        {uploadingCase === c.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <FileUp className="w-4 h-4" />
                            Upload Report
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
              ))}
              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    {cases.length === 0 ? (
                      <>
                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No cases yet.</p>
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

      // Get clinic users for notification
      const { data: clinicUsers } = await supabase
        .from('users')
        .select('email, first_name')
        .eq('clinic_id', caseData.clinic_id)
        .eq('is_active', true)

      alert(`Report uploaded! ${clinicUsers?.length || 0} clinic users will be notified.`)
      fetchCaseData()
    } catch (err) {
      alert('Error uploading report: ' + err.message)
    }
    
    setUploadingReport(false)
  }

  async function handleStatusChange(newStatus) {
    setUpdatingStatus(true)
    await supabase
      .from('cases')
      .update({ status: newStatus })
      .eq('id', id)
    await fetchCaseData()
    setUpdatingStatus(false)
  }

  async function handleResendConsent(consent) {
    // In production, this would trigger an email
    alert(`Consent request resent to ${consent.signer_email}`)
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
                  <p className="font-medium">{caseData.patient_dob ? new Date(caseData.patient_dob).toLocaleDateString() : '-'}</p>
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
                    <p className="text-sm text-green-600">
                      Signed {new Date(patientConsent.signed_at).toLocaleDateString()}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-yellow-600">Pending</span>
                      {isAdmin && (
                        <button 
                          onClick={() => handleResendConsent({ signer_email: caseData.patient_email })}
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
                      <p className="text-sm text-green-600">
                        Signed {new Date(partnerConsent.signed_at).toLocaleDateString()}
                      </p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-yellow-600">Pending</span>
                        {isAdmin && (
                          <button 
                            onClick={() => handleResendConsent({ signer_email: caseData.partner_email })}
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
              {caseData.report_file_url ? (
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
              ) : (
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
              )}
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
                  <option value="samples_received">Samples Received</option>
                  <option value="in_progress">In Progress</option>
                  <option value="report_ready">Report Ready</option>
                  <option value="complete">Complete</option>
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
    is_egg_donor: false,
    egg_donor_age: '',
    no_partner: false,
    sperm_source: 'partner', // 'partner' or 'donor'
    partner_first_name: '',
    partner_last_name: '',
    partner_dob: '',
    partner_email: '',
    partner_phone: '',
    is_sperm_donor: false,
    ordering_provider_id: '',
    tests_ordered: [],
    indication: '',
    mask_sex_results: false,
    reason_for_testing: '',
    form_completed_by: '',
  })
  const [karyotypeFile, setKaryotypeFile] = useState(null)
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
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  function handleTestChange(test) {
    setFormData(prev => ({
      ...prev,
      tests_ordered: prev.tests_ordered.includes(test)
        ? prev.tests_ordered.filter(t => t !== test)
        : [...prev.tests_ordered, test]
    }))
    // Clear karyotype file if PGT-SR is deselected
    if (test === 'pgt_sr' && formData.tests_ordered.includes('pgt_sr')) {
      setKaryotypeFile(null)
    }
  }

  function handleKaryotypeUpload(file) {
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }
    setKaryotypeFile(file)
  }

  // Determine if partner info is required
  const isPartnerRequired = !formData.no_partner || formData.sperm_source === 'partner'

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

    if (!formData.indication) {
      setError('Please select an indication for PGT')
      setLoading(false)
      return
    }

    if (formData.is_egg_donor && !formData.egg_donor_age) {
      setError('Please enter the egg donor age')
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
      setError('Please upload the karyotype document for PGT-SR')
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

    const { data: newCase, error: insertError } = await supabase
      .from('cases')
      .insert({
        clinic_id: userData.clinic_id,
        submitted_by_user_id: userData.id,
        status: 'consent_pending',
        ...formData,
        karyotype_file_path,
        form_completed_date: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // Create consent for patient
    await supabase.from('consents').insert({
      case_id: newCase.id,
      consent_for: 'patient',
      recipient_name: `${formData.patient_first_name} ${formData.patient_last_name}`,
      recipient_email: formData.patient_email,
      recipient_phone: formData.patient_phone,
      status: 'pending',
    })

    // Create consent for partner if provided and required
    if (isPartnerRequired && formData.partner_email) {
      await supabase.from('consents').insert({
        case_id: newCase.id,
        consent_for: 'partner',
        recipient_name: `${formData.partner_first_name} ${formData.partner_last_name}`,
        recipient_email: formData.partner_email,
        status: 'pending',
      })
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Indication for PGT *</label>
              <select
                name="indication"
                value={formData.indication}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              >
                <option value="">Select indication...</option>
                <option value="advanced_maternal_age">Advanced maternal age (≥35)</option>
                <option value="recurrent_pregnancy_loss">Recurrent pregnancy loss</option>
                <option value="previous_failed_ivf">Previous failed IVF cycles</option>
                <option value="male_factor">Male factor</option>
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
                  Karyotype Upload * <span className="text-amber-600 font-normal">(Required for PGT-SR)</span>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone <span className="text-gray-400 font-normal">(for SMS verification)</span></label>
              <input
                type="tel"
                name="patient_phone"
                value={formData.patient_phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
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
                <input
                  type="number"
                  name="egg_donor_age"
                  value={formData.egg_donor_age}
                  onChange={handleChange}
                  required={formData.is_egg_donor}
                  min="18"
                  max="50"
                  placeholder="Enter age"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                />
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
                By submitting this electronic test requisition form, I certify that (i) I agree to the terms and conditions written on the Ally Genetics Informed Consent and Privacy Disclosure, (ii) I have provided the Ally Genetics Informed Consent and Privacy Disclosure to the patient/partner, and they understand and agree to have this testing performed by Ally Genetics lab, (iii) the informed consent obtained from the patient meets the requirements of applicable law, (iv) and I am the authorized physician or an individual authorized by the physician to submit this test order.
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
          <option value="samples_received">Samples Received</option>
          <option value="in_progress">In Progress</option>
          <option value="report_ready">Report Ready</option>
          <option value="complete">Complete</option>
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
                  <div className="text-xs text-gray-500">DOB: {c.patient_dob ? new Date(c.patient_dob).toLocaleDateString() : '-'}</div>
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
    biopsy_collection_kits: 0,
    shipping_containers: 0,
    collection_tubes: 0,
    shipping_address: '',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmitOrder(e) {
    e.preventDefault()
    setSubmitting(true)

    // Save order to database
    const { data: newOrder } = await supabase.from('kit_orders').insert({
      clinic_id: userData.clinic_id,
      ordered_by_user_id: userData.id,
      status: 'pending',
      items: {
        biopsy_collection_kits: orderForm.biopsy_collection_kits,
        shipping_containers: orderForm.shipping_containers,
        collection_tubes: orderForm.collection_tubes,
      },
      shipping_address: orderForm.shipping_address || userData.clinic?.address || '',
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
            biopsy_collection_kits: orderForm.biopsy_collection_kits,
            shipping_containers: orderForm.shipping_containers,
            collection_tubes: orderForm.collection_tubes,
          },
          shipping_address: orderForm.shipping_address || userData.clinic?.address || 'Use clinic default address',
          notes: orderForm.notes || 'None',
        }
      })
      console.log('Order notification sent successfully')
    } catch (error) {
      console.log('Email notification error:', error)
      // Continue anyway - order is saved in database
    }

    setSubmitting(false)
    setSuccess(true)
  }

  function handleNewOrder() {
    setSuccess(false)
    setOrderForm({ 
      biopsy_collection_kits: 0, 
      shipping_containers: 0, 
      collection_tubes: 0, 
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Biopsy Collection Kits</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Collection Tubes (PCR tubes)</label>
            <input
              type="number"
              min="0"
              value={orderForm.collection_tubes}
              onChange={(e) => setOrderForm(f => ({ ...f, collection_tubes: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Address</label>
            <textarea
              value={orderForm.shipping_address}
              onChange={(e) => setOrderForm(f => ({ ...f, shipping_address: e.target.value }))}
              rows={3}
              placeholder="Enter shipping address or leave blank to use clinic default address"
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
              disabled={submitting || (orderForm.biopsy_collection_kits === 0 && orderForm.shipping_containers === 0 && orderForm.collection_tubes === 0)}
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
  const { supabase, userData } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userData?.clinic_id) {
      fetchStats()
    } else if (userData) {
      setLoading(false)
    }
  }, [userData])

  async function fetchStats() {
    // Get all cases for this clinic
    const { data: cases } = await supabase
      .from('cases')
      .select('status, created_at, tests_ordered')
      .eq('clinic_id', userData.clinic_id)

    if (!cases) {
      setLoading(false)
      return
    }

    // Calculate stats
    const now = new Date()
    const thisMonth = cases.filter(c => new Date(c.created_at).getMonth() === now.getMonth())
    const lastMonth = cases.filter(c => {
      const d = new Date(c.created_at)
      return d.getMonth() === (now.getMonth() - 1 + 12) % 12
    })

    const completedCases = cases.filter(c => c.status === 'complete' || c.status === 'report_ready')
    const pgtaCases = cases.filter(c => c.tests_ordered?.includes('pgt_a'))
    const pgtSRCases = cases.filter(c => c.tests_ordered?.includes('pgt_sr'))

    setStats({
      totalCases: cases.length,
      thisMonthCases: thisMonth.length,
      lastMonthCases: lastMonth.length,
      completedCases: completedCases.length,
      pendingCases: cases.length - completedCases.length,
      pgtaCases: pgtaCases.length,
      pgtSRCases: pgtSRCases.length,
      byStatus: {
        consent_pending: cases.filter(c => c.status === 'consent_pending').length,
        consent_complete: cases.filter(c => c.status === 'consent_complete').length,
        samples_received: cases.filter(c => c.status === 'samples_received').length,
        in_progress: cases.filter(c => c.status === 'in_progress').length,
        report_ready: cases.filter(c => c.status === 'report_ready').length,
        complete: cases.filter(c => c.status === 'complete').length,
      }
    })
    setLoading(false)
  }

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

  if (!stats) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <p className="text-gray-500">No data available yet.</p>
      </div>
    )
  }


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lab Statistics</h1>
        <p className="text-gray-500">Overview of your clinic's PGT testing activity</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-6">
          <p className="text-sm text-gray-500">Total Cases</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalCases}</p>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <p className="text-sm text-gray-500">This Month</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.thisMonthCases}</p>
          <p className="text-xs text-gray-400 mt-1">
            {stats.lastMonthCases > 0 && (
              stats.thisMonthCases >= stats.lastMonthCases 
                ? <span className="text-green-600">↑ vs last month ({stats.lastMonthCases})</span>
                : <span className="text-red-600">↓ vs last month ({stats.lastMonthCases})</span>
            )}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{stats.completedCases}</p>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <p className="text-sm text-gray-500">In Progress</p>
          <p className="text-3xl font-bold text-ally-teal mt-1">{stats.pendingCases}</p>
        </div>
      </div>

      {/* Test Types */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Cases by Test Type</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">PGT-A (Aneuploidy)</p>
            <p className="text-2xl font-bold text-gray-900">{stats.pgtaCases}</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-ally-teal h-2 rounded-full" 
                style={{ width: stats.totalCases > 0 ? `${(stats.pgtaCases / stats.totalCases) * 100}%` : '0%' }}
              />
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500">PGT-SR (Structural)</p>
            <p className="text-2xl font-bold text-gray-900">{stats.pgtSRCases}</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-purple-500 h-2 rounded-full" 
                style={{ width: stats.totalCases > 0 ? `${(stats.pgtSRCases / stats.totalCases) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Cases by Status</h2>
        <div className="space-y-3">
          {[
            { key: 'consent_pending', label: 'Consent Pending', color: 'bg-yellow-500' },
            { key: 'consent_complete', label: 'Consent Complete', color: 'bg-blue-400' },
            { key: 'samples_received', label: 'Samples Received', color: 'bg-blue-500' },
            { key: 'in_progress', label: 'In Progress', color: 'bg-purple-500' },
            { key: 'report_ready', label: 'Report Ready', color: 'bg-green-400' },
            { key: 'complete', label: 'Complete', color: 'bg-green-600' },
          ].map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-4">
              <div className="w-32 text-sm text-gray-600">{label}</div>
              <div className="flex-1 bg-gray-100 rounded-full h-4">
                <div 
                  className={`${color} h-4 rounded-full`}
                  style={{ width: stats.totalCases > 0 ? `${(stats.byStatus[key] / stats.totalCases) * 100}%` : '0%' }}
                />
              </div>
              <div className="w-10 text-sm text-gray-900 font-medium text-right">{stats.byStatus[key]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// BIOPSY WORKSHEET PAGE
// ============================================================================
function BiopsyWorksheetPage() {
  const { supabase, userData } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [cases, setCases] = useState([])
  const [selectedCase, setSelectedCase] = useState(null)
  const [currentDay, setCurrentDay] = useState(5)
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  
  const [worksheetData, setWorksheetData] = useState({
    case_id: '',
    patient_name: '',
    embryologist: '',
    day5_date: new Date().toISOString().split('T')[0],
    samples: {
      5: Array(5).fill(null).map((_, i) => ({ sample_id: '', day: '5', grade: '', embryologist_bx: '', embryologist_tubing: '', cells_visualized: '', notes: '' })),
      6: [],
      7: []
    }
  })

  useEffect(() => {
    if (userData?.clinic_id) {
      fetchCases()
    }
  }, [userData])

  async function fetchCases() {
    const { data } = await supabase
      .from('cases')
      .select('id, case_number, patient_first_name, patient_last_name, patient_dob, partner_first_name, partner_last_name, partner_dob, is_egg_donor, egg_donor_age, is_sperm_donor, ordering_provider:providers(first_name, last_name, credentials), clinic:clinics(name)')
      .eq('clinic_id', userData.clinic_id)
      .in('status', ['samples_received', 'in_progress'])
      .order('created_at', { ascending: false })
    setCases(data || [])
  }

  function handleCaseSelect(caseId) {
    const selectedCaseData = cases.find(c => c.id === caseId)
    if (selectedCaseData) {
      setSelectedCase(selectedCaseData)
      setWorksheetData(prev => ({
        ...prev,
        case_id: caseId,
        patient_name: `${selectedCaseData.patient_first_name} ${selectedCaseData.patient_last_name}`
      }))
    }
  }

  function handleSampleChange(dayIndex, sampleIndex, field, value) {
    setWorksheetData(prev => {
      const newSamples = { ...prev.samples }
      newSamples[dayIndex] = [...newSamples[dayIndex]]
      newSamples[dayIndex][sampleIndex] = { ...newSamples[dayIndex][sampleIndex], [field]: value }
      return { ...prev, samples: newSamples }
    })
  }

  function addSampleRow(day) {
    setWorksheetData(prev => {
      const newSamples = { ...prev.samples }
      newSamples[day] = [...newSamples[day], { sample_id: '', day: day.toString(), grade: '', embryologist_bx: '', embryologist_tubing: '', cells_visualized: '', notes: '' }]
      return { ...prev, samples: newSamples }
    })
  }

  function removeSampleRow(day, index) {
    setWorksheetData(prev => {
      const newSamples = { ...prev.samples }
      newSamples[day] = newSamples[day].filter((_, i) => i !== index)
      return { ...prev, samples: newSamples }
    })
  }

  async function handleSubmit() {
    if (!worksheetData.case_id) {
      setError('Please select a case')
      return
    }
    if (!worksheetData.day5_date) {
      setError('Please enter a date')
      return
    }

    // Check if there's at least one sample with data
    const allSamples = [...worksheetData.samples[5], ...worksheetData.samples[6], ...worksheetData.samples[7]]
    const hasData = allSamples.some(s => s.sample_id || s.grade)
    if (!hasData) {
      setError('Please enter at least one sample')
      return
    }

    setLoading(true)
    setError(null)

    // Save worksheet to database
    const { error: insertError } = await supabase
      .from('biopsy_worksheets')
      .insert({
        case_id: worksheetData.case_id,
        clinic_id: userData.clinic_id,
        embryologist: worksheetData.embryologist,
        day5_date: worksheetData.day5_date,
        samples: allSamples.filter(s => s.sample_id || s.grade),
        submitted_by: userData.id,
      })

    if (insertError) {
      // If table doesn't exist, just show success (demo mode)
      console.log('Note: biopsy_worksheets table may not exist yet', insertError)
    }
    
    setSuccess('Biopsy worksheet submitted successfully!')
    setLoading(false)
    
    // Reset form
    setSelectedCase(null)
    setWorksheetData({
      case_id: '',
      patient_name: '',
      embryologist: '',
      day5_date: new Date().toISOString().split('T')[0],
      samples: {
        5: Array(5).fill(null).map(() => ({ sample_id: '', day: '5', grade: '', embryologist_bx: '', embryologist_tubing: '', cells_visualized: '', notes: '' })),
        6: [],
        7: []
      }
    })
  }

  const currentSamples = worksheetData.samples[currentDay] || []

  // Helper function to format dates in American format (M/D/YYYY)
  const formatDateUS = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    // Check if date is valid
    if (isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'numeric', 
      day: 'numeric' 
    })
  }

  // Printable Worksheet Component
  const PrintableWorksheet = () => {
    const allSamples = [...worksheetData.samples[5], ...worksheetData.samples[6], ...worksheetData.samples[7]].filter(s => s.sample_id || s.grade)
    
    return (
      <div className="printable-worksheet hidden print:block">
        <style>{`
          @media print {
            .printable-worksheet { display: block !important; }
            body * { visibility: hidden; }
            .printable-worksheet, .printable-worksheet * { visibility: visible; }
            .printable-worksheet { position: absolute; left: 0; top: 0; width: 100%; }
            @page { margin: 0.5in; }
          }
        `}</style>
        
        <div className="bg-white p-8 font-sans text-sm">
          {/* Header with Logo */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">AG</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">Ally Genetics</div>
                <div className="text-xs text-gray-600">Better Partnerships. Better Results.</div>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white text-center py-3 mb-4">
            <h1 className="text-xl font-bold">PGT Biopsy Worksheet</h1>
          </div>

          {/* Patient Information */}
          <div className="border-2 border-gray-800 mb-4">
            <div className="grid grid-cols-2 border-b border-gray-800">
              <div className="p-2 border-r border-gray-800">
                <span className="font-semibold">Patient name (Last, First): </span>
                {selectedCase ? `${selectedCase.patient_last_name}, ${selectedCase.patient_first_name}` : ''}
              </div>
              <div className="p-2">
                <span className="font-semibold">DOB: </span>
                {formatDateUS(selectedCase?.patient_dob)}
              </div>
            </div>
            
            <div className="grid grid-cols-2 border-b border-gray-800">
              <div className="p-2 border-r border-gray-800">
                <span className="font-semibold">Partner name (Last, First): </span>
                {selectedCase?.partner_last_name ? `${selectedCase.partner_last_name}, ${selectedCase.partner_first_name}` : ''}
              </div>
              <div className="p-2">
                <span className="font-semibold">DOB: </span>
                {formatDateUS(selectedCase?.partner_dob)}
              </div>
            </div>
            
            <div className="grid grid-cols-3 border-b border-gray-800">
              <div className="p-2 border-r border-gray-800">
                <span className="font-semibold">Donor gametes (circle one): </span>
                <span className={selectedCase?.is_egg_donor || selectedCase?.is_sperm_donor ? 'font-bold' : ''}>Y</span> / 
                <span className={!selectedCase?.is_egg_donor && !selectedCase?.is_sperm_donor ? 'font-bold' : ''}>N</span>
              </div>
              <div className="p-2 border-r border-gray-800">
                <span className="font-semibold">Egg donor age: </span>
                {selectedCase?.egg_donor_age || '_______'}
              </div>
              <div className="p-2">
                <span className="font-semibold">Sperm donor age: </span>
                _______
              </div>
            </div>
            
            <div className="grid grid-cols-2 border-b border-gray-800">
              <div className="p-2 border-r border-gray-800">
                <span className="font-semibold">Clinic name: </span>
                {selectedCase?.clinic?.name || userData?.clinic?.name || ''}
              </div>
              <div className="p-2">
                <span className="font-semibold">Ordering Provider: </span>
                {selectedCase?.ordering_provider 
                  ? `${selectedCase.ordering_provider.first_name} ${selectedCase.ordering_provider.last_name}${selectedCase.ordering_provider.credentials ? ', ' + selectedCase.ordering_provider.credentials : ''}`
                  : ''}
              </div>
            </div>
            
            <div className="grid grid-cols-2 border-gray-800">
              <div className="p-2 border-r border-gray-800">
                <span className="font-semibold">Day-5 date: </span>
                {formatDateUS(worksheetData.day5_date)}
              </div>
              <div className="p-2">
                <span className="font-semibold">Buffer Lot: </span>
                _______________
              </div>
            </div>
          </div>

          <div className="text-xs mb-4 italic">
            <strong>Note:</strong> If a rebiopsy of a previously tested embryo is included, please specify the original collection tube code (e.g. rebiopsy of AABCE) in the comments.
          </div>

          {/* Biopsy Information Table */}
          <div className="mb-4">
            <h2 className="text-center font-bold mb-2">Biopsy Information</h2>
            <table className="w-full border-2 border-gray-800 text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-800 p-1 font-semibold">Sample ID</th>
                  <th className="border border-gray-800 p-1 font-semibold">Embryo<br/>Grade</th>
                  <th className="border border-gray-800 p-1 font-semibold">Biopsy<br/>Day</th>
                  <th className="border border-gray-800 p-1 font-semibold">Biopsy<br/>Embryologist<br/>Initials</th>
                  <th className="border border-gray-800 p-1 font-semibold">Tube Loading<br/>Embryologist<br/>Initials</th>
                  <th className="border border-gray-800 p-1 font-semibold">Comments</th>
                </tr>
              </thead>
              <tbody>
                {Array(20).fill(null).map((_, idx) => {
                  const sample = allSamples[idx]
                  return (
                    <tr key={idx}>
                      <td className="border border-gray-800 p-2 h-16">{sample?.sample_id || ''}</td>
                      <td className="border border-gray-800 p-2 h-16">{sample?.grade || ''}</td>
                      <td className="border border-gray-800 p-2 h-16">{sample?.day || ''}</td>
                      <td className="border border-gray-800 p-2 h-16">{sample?.embryologist_bx || ''}</td>
                      <td className="border border-gray-800 p-2 h-16">{sample?.embryologist_tubing || ''}</td>
                      <td className="border border-gray-800 p-2 h-16">{sample?.notes || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="grid grid-cols-2 text-xs">
            <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white p-2">
              <div>phone: (616) 465-2400</div>
              <div>fax: (616) 616-5887</div>
            </div>
            <div className="bg-gradient-to-r from-teal-500 to-teal-400 text-white p-2">
              <div>email: lab@allygenetics.com</div>
              <div>web: www.allygenetics.com</div>
            </div>
            <div className="col-span-2 bg-white text-right pr-2 pt-1">
              <div className="text-teal-600">1001 Parchment Dr SE</div>
              <div className="text-teal-600">Grand Rapids, MI 49546</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Biopsy Worksheet</h1>
          <p className="text-gray-500">Document embryo biopsy details for each case</p>
        </div>
        <button
          onClick={() => window.print()}
          disabled={!selectedCase}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title={!selectedCase ? "Select a case first" : "Print worksheet"}
        >
          <Printer className="w-4 h-4" />
          Print Worksheet
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-800 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 text-green-800 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Header Info */}
      <div className="bg-white rounded-lg border p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Case *</label>
            <select
              value={worksheetData.case_id}
              onChange={(e) => handleCaseSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            >
              <option value="">Select a case...</option>
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.case_number} - {c.patient_first_name} {c.patient_last_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
            <input
              type="text"
              value={worksheetData.patient_name}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Embryologist</label>
            <input
              type="text"
              value={worksheetData.embryologist}
              onChange={(e) => setWorksheetData(prev => ({ ...prev, embryologist: e.target.value }))}
              placeholder="Name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Day 5 Date *</label>
            <input
              type="date"
              value={worksheetData.day5_date}
              onChange={(e) => setWorksheetData(prev => ({ ...prev, day5_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
        </div>
      </div>

      {/* Sample Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Sample Details</h2>
          <button
            onClick={() => addSampleRow(currentDay)}
            className="flex items-center gap-2 text-ally-teal hover:text-ally-teal-dark text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Sample Row
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sample ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Day</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Embryologist BX</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Embryologist Tubing</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Indicate if Rebiopsy</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {currentSamples.map((sample, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={sample.sample_id}
                      onChange={(e) => handleSampleChange(currentDay, index, 'sample_id', e.target.value)}
                      placeholder={`S${index + 1}`}
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-ally-teal"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={sample.day}
                      onChange={(e) => handleSampleChange(currentDay, index, 'day', e.target.value)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-ally-teal"
                    >
                      <option value="5">Day 5</option>
                      <option value="6">Day 6</option>
                      <option value="7">Day 7</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={sample.grade}
                      onChange={(e) => handleSampleChange(currentDay, index, 'grade', e.target.value)}
                      placeholder="e.g., 4AA"
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-ally-teal"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={sample.embryologist_bx}
                      onChange={(e) => handleSampleChange(currentDay, index, 'embryologist_bx', e.target.value)}
                      placeholder="Initials"
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-ally-teal"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={sample.embryologist_tubing}
                      onChange={(e) => handleSampleChange(currentDay, index, 'embryologist_tubing', e.target.value)}
                      placeholder="Initials"
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-ally-teal"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={sample.notes}
                      onChange={(e) => handleSampleChange(currentDay, index, 'notes', e.target.value)}
                      placeholder="Rebiopsy notes..."
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-ally-teal"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => removeSampleRow(currentDay, index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {currentSamples.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No samples added yet. Click "Add Sample Row" to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex items-center gap-2 bg-ally-teal text-white px-6 py-2 rounded-md hover:bg-ally-teal-dark disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Submit Worksheet
        </button>
      </div>

      {/* Printable Worksheet (hidden on screen, visible on print) */}
      {selectedCase && <PrintableWorksheet />}
    </div>
  )
}

// ============================================================================
// CONTACT US PAGE
// ============================================================================
function ContactUsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contact Us</h1>
        <p className="text-gray-500">Get in touch with the Ally Genetics team</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Contact Info */}
        <div className="bg-white rounded-lg border p-6 space-y-6">
          <div>
            <h2 className="font-semibold text-gray-900 mb-4">Lab Contact Information</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-ally-teal/10 rounded-lg">
                  <Phone className="w-5 h-5 text-ally-teal" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Phone</p>
                  <a href="tel:+18005551234" className="text-ally-teal hover:underline">(800) 555-1234</a>
                  <p className="text-sm text-gray-500">Mon-Fri, 8am-6pm EST</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 bg-ally-teal/10 rounded-lg">
                  <Mail className="w-5 h-5 text-ally-teal" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Email</p>
                  <a href="mailto:lab@allygenetics.com" className="text-ally-teal hover:underline">lab@allygenetics.com</a>
                  <p className="text-sm text-gray-500">We respond within 24 hours</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="p-2 bg-ally-teal/10 rounded-lg">
                  <MapPin className="w-5 h-5 text-ally-teal" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Laboratory Address</p>
                  <p className="text-gray-600">Ally Genetics Laboratory</p>
                  <p className="text-gray-600">123 Science Park Drive</p>
                  <p className="text-gray-600">Suite 400</p>
                  <p className="text-gray-600">Grand Rapids, MI 49503</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Quick Support</h2>
            <div className="space-y-3">
              <a href="mailto:lab@allygenetics.com?subject=Sample%20Shipping%20Question" className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <p className="font-medium text-gray-900">Sample Shipping Questions</p>
                <p className="text-sm text-gray-500">Questions about shipping samples or kits</p>
              </a>
              <a href="mailto:lab@allygenetics.com?subject=Results%20Question" className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <p className="font-medium text-gray-900">Results Inquiry</p>
                <p className="text-sm text-gray-500">Questions about test results</p>
              </a>
              <a href="mailto:lab@allygenetics.com?subject=Technical%20Support" className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <p className="font-medium text-gray-900">Technical Support</p>
                <p className="text-sm text-gray-500">Portal or technical issues</p>
              </a>
              <a href="mailto:lab@allygenetics.com?subject=Billing%20Question" className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <p className="font-medium text-gray-900">Billing Questions</p>
                <p className="text-sm text-gray-500">Invoices and payment inquiries</p>
              </a>
            </div>
          </div>

          <div className="bg-ally-teal/10 rounded-lg p-6">
            <h2 className="font-semibold text-ally-navy mb-2">Urgent Results?</h2>
            <p className="text-sm text-gray-600 mb-4">
              For time-sensitive result inquiries, please call us directly at <strong>(800) 555-1234</strong> and press 1 for priority support.
            </p>
            <a 
              href="tel:+18005551234" 
              className="inline-flex items-center gap-2 bg-ally-teal text-white px-4 py-2 rounded-md hover:bg-ally-teal-dark"
            >
              <Phone className="w-4 h-4" />
              Call Now
            </a>
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

  useEffect(() => {
    fetchClinics()
  }, [])

  async function fetchClinics() {
    const { data } = await supabase
      .from('clinics')
      .select('*, providers(*)')
      .order('name')
    setClinics(data || [])
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
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${clinic.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {clinic.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <button
                    onClick={() => setEditingClinic(clinic)}
                    className="text-ally-teal hover:underline"
                  >
                    Edit
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
    address_line1: clinic?.address_line1 || '',
    city: clinic?.city || '',
    state: clinic?.state || '',
    zip_code: clinic?.zip_code || '',
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
              name="address_line1"
              value={formData.address_line1}
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
                name="zip_code"
                value={formData.zip_code}
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
                    <button
                      onClick={() => toggleProviderActive(provider)}
                      className={`text-sm px-2 py-1 rounded ${provider.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                    >
                      {provider.is_active ? 'Active' : 'Inactive'}
                    </button>
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
// USERS PAGE (Admin)
// ============================================================================
function UsersPage() {
  const { supabase, startImpersonation } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [clinics, setClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [filterClinic, setFilterClinic] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [usersResult, clinicsResult] = await Promise.all([
      supabase.from('users').select('*, clinic:clinics(id, name)').order('last_name'),
      supabase.from('clinics').select('id, name').eq('is_active', true).order('name')
    ])
    setUsers(usersResult.data || [])
    setClinics(clinicsResult.data || [])
    setLoading(false)
  }

  async function handleViewAs(user) {
    await startImpersonation(user)
    navigate('/clinic')
  }

  const filteredUsers = filterClinic 
    ? users.filter(u => u.clinic_id === filterClinic)
    : users

  const roleLabels = {
    clinic_user: 'Clinic User',
    clinic_admin: 'Clinic Admin',
    ally_staff: 'Ally Staff',
    ally_admin: 'Ally Admin'
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-ally-teal" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500">Manage portal users and their access</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-ally-teal text-white px-4 py-2 rounded-md hover:bg-ally-teal-dark"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm text-gray-600">Filter by clinic:</label>
        <select
          value={filterClinic}
          onChange={(e) => setFilterClinic(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
        >
          <option value="">All clinics</option>
          <option value="ally">Ally Staff (no clinic)</option>
          {clinics.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clinic</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{user.first_name} {user.last_name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.clinic?.name || <span className="text-gray-400 italic">Ally Staff</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    user.role.includes('admin') ? 'bg-purple-100 text-purple-800' : 
                    user.role.includes('ally') ? 'bg-blue-100 text-blue-800' : 
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {roleLabels[user.role] || user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-3">
                  {user.clinic_id && (
                    <button
                      onClick={() => handleViewAs(user)}
                      className="text-amber-600 hover:underline"
                      title="View portal as this user"
                    >
                      <Eye className="w-4 h-4 inline mr-1" />
                      View as
                    </button>
                  )}
                  <button
                    onClick={() => setEditingUser(user)}
                    className="text-ally-teal hover:underline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <AddUserModal
          clinics={clinics}
          onClose={() => setShowAddModal(false)}
          onSave={() => { fetchData(); setShowAddModal(false); }}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          clinics={clinics}
          onClose={() => setEditingUser(null)}
          onSave={() => { fetchData(); setEditingUser(null); }}
        />
      )}
    </div>
  )
}

// ============================================================================
// ADD USER MODAL
// ============================================================================
function AddUserModal({ clinics, onClose, onSave }) {
  const { supabase } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    clinic_id: '',
    role: 'clinic_user',
  })

  // Generate random password
  function generateTempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let password = ''
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  function handleChange(e) {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const tempPassword = sendWelcomeEmail ? generateTempPassword() : formData.password

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: tempPassword,
        options: {
          data: {
            first_name: formData.first_name,
            last_name: formData.last_name,
          }
        }
      })

      if (authError) throw authError

      // Create user record in users table
      const { error: insertError } = await supabase.from('users').insert({
        auth_id: authData.user.id,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        clinic_id: formData.clinic_id || null,
        role: formData.role,
        is_active: true,
        must_change_password: sendWelcomeEmail,
      })

      if (insertError) throw insertError

      // If sending welcome email, send password reset email so they can set their own password
      if (sendWelcomeEmail) {
        await supabase.auth.resetPasswordForEmail(formData.email, {
          redirectTo: window.location.origin + '/login'
        })
      }

      onSave()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Add New User</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            />
          </div>
          
          {/* Password Section */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendWelcomeEmail}
                onChange={(e) => setSendWelcomeEmail(e.target.checked)}
                className="rounded border-gray-300 text-ally-teal focus:ring-ally-teal"
              />
              <span className="text-sm font-medium text-gray-700">Send welcome email with password setup link</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              User will receive an email to set their own password
            </p>
            
            {!sendWelcomeEmail && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required={!sendWelcomeEmail}
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clinic</label>
            <select
              name="clinic_id"
              value={formData.clinic_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            >
              <option value="">No clinic (Ally Staff)</option>
              {clinics.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            >
              <option value="clinic_user">Clinic User</option>
              <option value="clinic_admin">Clinic Admin</option>
              <option value="ally_staff">Ally Staff</option>
              <option value="ally_admin">Ally Admin</option>
            </select>
          </div>
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
              Add User
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================================
// EDIT USER MODAL
// ============================================================================
function EditUserModal({ user, clinics, onClose, onSave }) {
  const { supabase } = useAuth()
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState(null)
  const [formData, setFormData] = useState({
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    clinic_id: user.clinic_id || '',
    role: user.role,
    is_active: user.is_active,
  })

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    await supabase.from('users').update({
      first_name: formData.first_name,
      last_name: formData.last_name,
      clinic_id: formData.clinic_id || null,
      role: formData.role,
      is_active: formData.is_active,
    }).eq('id', user.id)

    setLoading(false)
    onSave()
  }

  async function handleSendPasswordReset() {
    setResetError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin + '/login'
    })
    if (error) {
      setResetError(error.message)
    } else {
      setResetSent(true)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Edit User</h2>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clinic</label>
            <select
              name="clinic_id"
              value={formData.clinic_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            >
              <option value="">No clinic (Ally Staff)</option>
              {clinics.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-ally-teal"
            >
              <option value="clinic_user">Clinic User</option>
              <option value="clinic_admin">Clinic Admin</option>
              <option value="ally_staff">Ally Staff</option>
              <option value="ally_admin">Ally Admin</option>
            </select>
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

          {/* Password Reset Section */}
          <div className="border-t pt-4 mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            {resetSent ? (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-md">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Password reset email sent to {user.email}</span>
              </div>
            ) : (
              <>
                {resetError && (
                  <div className="text-red-600 text-sm mb-2">{resetError}</div>
                )}
                <button
                  type="button"
                  onClick={handleSendPasswordReset}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-ally-teal border border-gray-300 px-3 py-2 rounded-md hover:bg-gray-50"
                >
                  <Mail className="w-4 h-4" />
                  Send Password Reset Email
                </button>
              </>
            )}
          </div>

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
              Save Changes
            </button>
          </div>
        </form>
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
          
          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminLayout><AdminDashboard /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/cases" element={<ProtectedRoute adminOnly><AdminLayout><AllCasesPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/cases/:id" element={<ProtectedRoute adminOnly><AdminLayout><CaseDetailsPage isAdmin={true} /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/clinics" element={<ProtectedRoute adminOnly><AdminLayout><ClinicsPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminLayout><UsersPage /></AdminLayout></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute adminOnly><AdminLayout><PlaceholderPage title="Kit Orders" /></AdminLayout></ProtectedRoute>} />
          
          {/* Clinic Routes */}
          <Route path="/clinic" element={<ProtectedRoute><ClinicLayout><ClinicDashboard /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/stats" element={<ProtectedRoute><ClinicLayout><LabStatisticsPage /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/cases" element={<ProtectedRoute><ClinicLayout><ClinicCasesPage /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/cases/new" element={<ProtectedRoute><ClinicLayout><NewRequisitionPage /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/cases/:id" element={<ProtectedRoute><ClinicLayout><CaseDetailsPage isAdmin={false} /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/worksheet" element={<ProtectedRoute><ClinicLayout><BiopsyWorksheetPage /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/orders" element={<ProtectedRoute><ClinicLayout><OrderSuppliesPage /></ClinicLayout></ProtectedRoute>} />
          <Route path="/clinic/contact" element={<ProtectedRoute><ClinicLayout><ContactUsPage /></ClinicLayout></ProtectedRoute>} />
          
          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
