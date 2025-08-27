import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../services/firebase'
import { onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'firebase/auth'
import { getUserRole } from '../services/users'   

const AuthCtx = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)         
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null)
        setRole(null)
        setLoading(false)
        return
      }
      setUser(u)
      // carrega papel no Firestore
      try {
        const r = await getUserRole(u.uid, u.email)
        setRole(r)
      } catch (e) {
        console.error('[Auth] erro ao obter role:', e)
        setRole('comum')
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => signOut(auth)

  const isAdmin = role === 'admin'               // <-- NOVO

  return (
    <AuthCtx.Provider value={{ user, role, isAdmin, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
