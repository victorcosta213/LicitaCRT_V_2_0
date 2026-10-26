/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
import { getUserProfile } from '../services/users'

const AuthCtx = createContext()

// acesso: 'liberado' | 'sem_perfil' | 'inativo' | 'erro' (null = deslogado)
// Mesma regra do banco (gc_role): sem perfil ativo em public.usuarios não há acesso.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [acesso, setAcesso] = useState(null)
  const [loading, setLoading] = useState(true)
  const [precisaTrocarSenha, setPrecisaTrocarSenha] = useState(false)
  const userIdRef = useRef(null)
  const leituraRef = useRef(0)

  const handleUser = useCallback(async (u) => {
    if (!u) {
      userIdRef.current = null
      setUser(null)
      setProfile(null)
      setAcesso(null)
      setPrecisaTrocarSenha(false)
      setLoading(false)
      return
    }
    const mesmoUsuario = userIdRef.current === u.id
    userIdRef.current = u.id
    setUser(u)
    const leitura = ++leituraRef.current
    try {
      const p = await getUserProfile(u.id)
      // senha provisória (primeiro acesso ou redefinida pelo administrador): a pessoa só avança depois de criar a dela.
      // Se a consulta falhar (ex.: migration ainda não aplicada), não trava ninguém.
      let trocar = false
      if (p && p.ativo !== false) {
        const { data, error } = await supabase.rpc('gc_precisa_trocar_senha')
        if (error) console.warn('[Auth] não foi possível verificar a senha provisória:', error.message)
        else trocar = data === true
      }
      if (leitura !== leituraRef.current) return // uma leitura mais nova já respondeu
      setProfile(p)
      setAcesso(!p ? 'sem_perfil' : p.ativo === false ? 'inativo' : 'liberado')
      setPrecisaTrocarSenha(trocar)
    } catch (e) {
      console.error('[Auth] erro ao obter perfil:', e)
      // Falha momentânea (ex.: ao renovar o token) não derruba quem já estava liberado
      setAcesso((atual) => (mesmoUsuario && atual === 'liberado' ? atual : 'erro'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => handleUser(session?.user))
      .catch((err) => {
        // sem rede ou sessão ilegível: mostra o login em vez de ficar carregando para sempre
        console.error('[Auth] erro ao ler a sessão:', err)
        handleUser(null)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleUser(session?.user)
    })

    return () => subscription.unsubscribe()
  }, [handleUser])

  const login = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const logout = () => supabase.auth.signOut()
  const recarregarPerfil = () => {
    setLoading(true)
    return handleUser(user)
  }

  // chamada depois que o banco confirmou a troca; leituras em andamento deixam de valer
  const senhaTrocada = () => {
    leituraRef.current += 1
    setPrecisaTrocarSenha(false)
  }

  const role = acesso === 'liberado' ? (profile?.role || 'viewer') : null
  const isAdmin = role === 'admin'

  return (
    <AuthCtx.Provider value={{
      user, role, profile, acesso, nome: profile?.nome || user?.email || '',
      isAdmin, loading, login, logout, recarregarPerfil, precisaTrocarSenha, senhaTrocada,
    }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
