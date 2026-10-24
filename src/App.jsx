import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { SessionProvider } from './hooks/useSession'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Session from './pages/Session'
import Summary from './pages/Summary'
import Catalog from './pages/Catalog'
import Admin from './pages/Admin'
import ResetPassword from './pages/ResetPassword'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
      Loading…
    </div>
  )
}

// The router keeps the previous page's scroll offset; start every page at the top
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function AdminRoute() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (!user.isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <AuthProvider>
      <SessionProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/login"          element={<Login />} />
            <Route path="/signup"         element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/"         element={<Session />} />
              <Route path="/summary"  element={<Summary />} />
              <Route path="/catalog"  element={<Catalog />} />
            </Route>
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </AuthProvider>
  )
}
