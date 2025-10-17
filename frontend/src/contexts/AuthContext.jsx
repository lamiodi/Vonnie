import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, auth, utils } from '../lib/supabase'
import { toast } from 'react-hot-toast'

// Create Auth Context
const AuthContext = createContext({})

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(true)

  // Initialize auth state
  useEffect(() => {
    let mounted = true

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          toast.error('Authentication error occurred')
        }

        if (mounted) {
          if (session?.user) {
            setUser(session.user)
            await fetchUserProfile(session.user.id)
          }
          setInitializing(false)
          setLoading(false)
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted) {
          setInitializing(false)
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        if (mounted) {
          setLoading(true)
          
          if (session?.user) {
            setUser(session.user)
            await fetchUserProfile(session.user.id)
          } else {
            setUser(null)
            setProfile(null)
          }
          
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  // Fetch user profile from database
  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await utils.getUserProfile(userId)
      
      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      setProfile(data)
    } catch (error) {
      console.error('Profile fetch error:', error)
    }
  }

  // Sign up function
  const signUp = async (email, password, userData = {}) => {
    try {
      setLoading(true)
      const { data, error } = await auth.signUp(email, password, userData)
      
      if (error) {
        toast.error(utils.formatError(error))
        return { success: false, error }
      }

      if (data.user && !data.session) {
        toast.success('Please check your email to confirm your account')
      }

      return { success: true, data }
    } catch (error) {
      console.error('Sign up error:', error)
      toast.error('An unexpected error occurred during sign up')
      return { success: false, error }
    } finally {
      setLoading(false)
    }
  }

  // Sign in function
  const signIn = async (email, password) => {
    try {
      setLoading(true)
      const { data, error } = await auth.signIn(email, password)
      
      if (error) {
        toast.error(utils.formatError(error))
        return { success: false, error }
      }

      toast.success('Welcome back!')
      return { success: true, data }
    } catch (error) {
      console.error('Sign in error:', error)
      toast.error('An unexpected error occurred during sign in')
      return { success: false, error }
    } finally {
      setLoading(false)
    }
  }

  // Sign out function
  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await auth.signOut()
      
      if (error) {
        toast.error(utils.formatError(error))
        return { success: false, error }
      }

      toast.success('Signed out successfully')
      return { success: true }
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('An unexpected error occurred during sign out')
      return { success: false, error }
    } finally {
      setLoading(false)
    }
  }

  // Reset password function
  const resetPassword = async (email) => {
    try {
      setLoading(true)
      const { data, error } = await auth.resetPassword(email)
      
      if (error) {
        toast.error(utils.formatError(error))
        return { success: false, error }
      }

      toast.success('Password reset email sent. Please check your inbox.')
      return { success: true, data }
    } catch (error) {
      console.error('Reset password error:', error)
      toast.error('An unexpected error occurred')
      return { success: false, error }
    } finally {
      setLoading(false)
    }
  }

  // Update password function
  const updatePassword = async (password) => {
    try {
      setLoading(true)
      const { data, error } = await auth.updatePassword(password)
      
      if (error) {
        toast.error(utils.formatError(error))
        return { success: false, error }
      }

      toast.success('Password updated successfully')
      return { success: true, data }
    } catch (error) {
      console.error('Update password error:', error)
      toast.error('An unexpected error occurred')
      return { success: false, error }
    } finally {
      setLoading(false)
    }
  }

  // Update user profile function
  const updateProfile = async (profileData) => {
    try {
      setLoading(true)
      
      if (!user?.id) {
        throw new Error('No user logged in')
      }

      const { data, error } = await utils.updateUserProfile(user.id, profileData)
      
      if (error) {
        toast.error(utils.formatError(error))
        return { success: false, error }
      }

      setProfile(data)
      toast.success('Profile updated successfully')
      return { success: true, data }
    } catch (error) {
      console.error('Update profile error:', error)
      toast.error('An unexpected error occurred')
      return { success: false, error }
    } finally {
      setLoading(false)
    }
  }

  // Refresh user data
  const refreshUser = async () => {
    if (user?.id) {
      await fetchUserProfile(user.id)
    }
  }

  // Check if user has specific role
  const hasRole = (role) => {
    return profile?.role === role
  }

  // Check if user has any of the specified roles
  const hasAnyRole = (roles) => {
    return roles.includes(profile?.role)
  }

  // Check if user is admin
  const isAdmin = () => hasRole('admin')

  // Check if user is staff
  const isStaff = () => hasRole('staff')

  // Check if user is customer
  const isCustomer = () => hasRole('customer')

  // Check if user can access admin features
  const canAccessAdmin = () => hasAnyRole(['admin'])

  // Check if user can access staff features
  const canAccessStaff = () => hasAnyRole(['admin', 'staff'])

  // Get user's full name
  const getFullName = () => {
    if (!profile) return user?.email || 'User'
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'User'
  }

  // Get user's display name
  const getDisplayName = () => {
    if (!profile) return user?.email || 'User'
    return profile.first_name || profile.email || 'User'
  }

  // Get user's avatar URL
  const getAvatarUrl = () => {
    return profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(getFullName())}&background=f3e8ff&color=7c3aed&size=128`
  }

  // Context value
  const value = {
    // State
    user,
    profile,
    loading,
    initializing,
    
    // Auth functions
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshUser,
    
    // Role checking functions
    hasRole,
    hasAnyRole,
    isAdmin,
    isStaff,
    isCustomer,
    canAccessAdmin,
    canAccessStaff,
    
    // Utility functions
    getFullName,
    getDisplayName,
    getAvatarUrl,
    
    // Computed properties
    isAuthenticated: !!user,
    isEmailConfirmed: user?.email_confirmed_at != null,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext