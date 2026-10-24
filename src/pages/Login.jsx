import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [params] = useSearchParams()
  const verify = params.get('verify')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(error)
    } else {
      navigate('/')
    }
  }

  async function handleResetRequest(e) {
    e.preventDefault()
    setResetLoading(true)
    await api.post('/auth/forgot', { email: resetEmail })
    setResetLoading(false)
    setResetSent(true)
  }

  if (showForgot) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
          {resetSent ? (
            <div className="text-center">
              <div className="text-4xl mb-4">✉️</div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Check your email</h2>
              <p className="text-sm text-gray-500 mb-5">
                If an account exists for <strong>{resetEmail}</strong>, you&apos;ll receive a password reset link shortly.
              </p>
              <button
                onClick={() => { setShowForgot(false); setResetSent(false); setResetEmail('') }}
                className="text-sm text-gray-900 font-medium hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Reset password</h1>
              <p className="text-sm text-gray-400 mb-6">We&apos;ll email you a reset link</p>
              <form onSubmit={handleResetRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {resetLoading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-5">
                <button onClick={() => setShowForgot(false)} className="text-gray-900 font-medium hover:underline">
                  Back to sign in
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Sign in</h1>
        <p className="text-sm text-gray-400 mb-6">CoffeeCounter</p>

        {verify === 'ok' && (
          <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-4">Email confirmed. You can sign in now.</p>
        )}
        {verify === 'invalid' && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">That confirmation link is invalid or has expired.</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="flex items-center justify-between mt-5">
          <p className="text-sm text-gray-500">
            No account?{' '}
            <Link to="/signup" className="text-gray-900 font-medium hover:underline">Sign up</Link>
          </p>
          <button
            onClick={() => setShowForgot(true)}
            className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
          >
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  )
}
