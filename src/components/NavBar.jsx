import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function NavBar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.isAdmin

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-3xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link to="/" className="font-bold text-gray-900 text-sm tracking-tight">Nespresso Inventory</Link>
          <Link to="/catalog" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Catalog</Link>
          {isAdmin && (
            <Link to="/admin" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Admin</Link>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 hidden sm:block truncate max-w-[180px]">{user?.email}</span>
          <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
