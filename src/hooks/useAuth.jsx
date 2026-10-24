import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      setUser(data?.user ?? null)
      setLoading(false)
    })
  }, [])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await api.post('/auth/login', { email, password })
    if (data) setUser(data.user)
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    await api.post('/auth/logout')
    setUser(null)
  }, [])

  // Used after a password reset, which signs the user in
  const setSessionUser = useCallback(u => setUser(u), [])

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, setSessionUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
