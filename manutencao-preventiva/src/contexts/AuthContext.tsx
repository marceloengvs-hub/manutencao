import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

const ALLOWED_EMAILS = [
  'marcelo.engvs@gmail.com',
  'marcelo.sousa@ufg.br',
  'geovaneumarques@gmail.com',
  'pedro_schaitl@ufg.br',
  'lauraduarte@ufg.br',
  'raquel_machtue@ufg.br',
  'mscarriao@ufg.br'
]

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithEmail: (email: string, password: string, nome: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (s?.user?.email && !ALLOWED_EMAILS.includes(s.user.email.toLowerCase())) {
        await supabase.auth.signOut()
        setSession(null)
        setUser(null)
        toast.error('E-mail não autorizado para acesso.')
        setLoading(false)
        return
      }
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })


    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { origin } = window.location
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: `${origin}/home`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      },
    })
  }, [])


  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!ALLOWED_EMAILS.includes(email.toLowerCase())) {
      return { error: 'Este e-mail não possui autorização de acesso.' }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signUpWithEmail = useCallback(async (email: string, password: string, nome: string) => {
    if (!ALLOWED_EMAILS.includes(email.toLowerCase())) {
      return { error: 'Este e-mail não possui autorização para criar conta.' }
    }
    const { error } = await supabase.auth.signUp({

      email,
      password,
      options: { data: { full_name: nome } },
    })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
