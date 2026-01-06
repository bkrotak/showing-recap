'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/r/', // For feedback links
]

// Routes that are completely public (no auth check needed)
const OPEN_ROUTES = [
  '/',
]

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Error getting session:', error)
      }

      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      // Handle authentication redirects
      handleAuthRedirect(session, pathname)
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        // Handle authentication redirects
        handleAuthRedirect(session, pathname)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleAuthRedirect = (session: Session | null, currentPath: string) => {
    const isPublicRoute = PUBLIC_ROUTES.some(route => currentPath.startsWith(route))
    const isOpenRoute = OPEN_ROUTES.includes(currentPath)

    if (!session && !isPublicRoute && !isOpenRoute) {
      // Not authenticated and trying to access protected route
      router.push('/login')
    } else if (session && currentPath === '/login') {
      // Authenticated user on login page, redirect to dashboard
      router.push('/dashboard')
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const value = {
    user,
    session,
    loading,
    signOut,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}