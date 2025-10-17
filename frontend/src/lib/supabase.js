import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check for valid Supabase configuration
const hasValidConfig = supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' && 
  supabaseAnonKey !== 'your-anon-key-here'

if (!hasValidConfig) {
  console.warn(
    'Supabase not configured. Using mock client for development. Please update your .env file with valid Supabase credentials.'
  )
}

// Create Supabase client with fallback for development
export const supabase = hasValidConfig 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: window.localStorage,
        storageKey: 'vonne-x2x-auth-token',
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'X-Client-Info': 'vonne-x2x-frontend',
        },
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : createClient('https://mock.supabase.co', 'mock-key', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        storage: window.localStorage,
        storageKey: 'vonne-x2x-mock-auth-token',
      },
    })

// Auth helpers
export const auth = {
  // Sign up new user
  signUp: async (email, password, userData = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData,
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })
    return { data, error }
  },

  // Sign in user
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },

  // Sign out user
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Reset password
  resetPassword: async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { data, error }
  },

  // Update password
  updatePassword: async (password) => {
    const { data, error } = await supabase.auth.updateUser({
      password,
    })
    return { data, error }
  },

  // Update user metadata
  updateUser: async (userData) => {
    const { data, error } = await supabase.auth.updateUser({
      data: userData,
    })
    return { data, error }
  },

  // Get current session
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession()
    return { data, error }
  },

  // Get current user
  getUser: async () => {
    const { data, error } = await supabase.auth.getUser()
    return { data, error }
  },

  // Refresh session
  refreshSession: async () => {
    const { data, error } = await supabase.auth.refreshSession()
    return { data, error }
  },
}

// Database helpers
export const db = {
  // Generic select
  select: (table, columns = '*') => {
    return supabase.from(table).select(columns)
  },

  // Generic insert
  insert: (table, data) => {
    return supabase.from(table).insert(data)
  },

  // Generic update
  update: (table, data) => {
    return supabase.from(table).update(data)
  },

  // Generic delete
  delete: (table) => {
    return supabase.from(table).delete()
  },

  // Generic upsert
  upsert: (table, data) => {
    return supabase.from(table).upsert(data)
  },
}

// Storage helpers
export const storage = {
  // Upload file
  upload: async (bucket, path, file, options = {}) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, options)
    return { data, error }
  },

  // Download file
  download: async (bucket, path) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path)
    return { data, error }
  },

  // Get public URL
  getPublicUrl: (bucket, path) => {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)
    return data.publicUrl
  },

  // Delete file
  remove: async (bucket, paths) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(paths)
    return { data, error }
  },

  // List files
  list: async (bucket, path = '', options = {}) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path, options)
    return { data, error }
  },
}

// Realtime helpers
export const realtime = {
  // Subscribe to table changes
  subscribe: (table, callback, filter = '*') => {
    return supabase
      .channel(`public:${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filter,
        },
        callback
      )
      .subscribe()
  },

  // Subscribe to specific events
  subscribeToInserts: (table, callback, filter) => {
    return supabase
      .channel(`public:${table}:insert`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: table,
          filter: filter,
        },
        callback
      )
      .subscribe()
  },

  subscribeToUpdates: (table, callback, filter) => {
    return supabase
      .channel(`public:${table}:update`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: table,
          filter: filter,
        },
        callback
      )
      .subscribe()
  },

  subscribeToDeletes: (table, callback, filter) => {
    return supabase
      .channel(`public:${table}:delete`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: table,
          filter: filter,
        },
        callback
      )
      .subscribe()
  },

  // Unsubscribe from channel
  unsubscribe: (subscription) => {
    return supabase.removeChannel(subscription)
  },
}

// Utility functions
export const utils = {
  // Check if user is authenticated
  isAuthenticated: async () => {
    const { data } = await auth.getSession()
    return !!data.session
  },

  // Get user profile
  getUserProfile: async (userId) => {
    const { data, error } = await db
      .select('profiles')
      .eq('id', userId)
      .single()
    return { data, error }
  },

  // Update user profile
  updateUserProfile: async (userId, profileData) => {
    const { data, error } = await db
      .update('profiles', profileData)
      .eq('id', userId)
      .select()
      .single()
    return { data, error }
  },

  // Format error message
  formatError: (error) => {
    if (!error) return null
    
    // Handle common Supabase errors
    switch (error.code) {
      case 'invalid_credentials':
        return 'Invalid email or password'
      case 'email_not_confirmed':
        return 'Please check your email and click the confirmation link'
      case 'signup_disabled':
        return 'Sign up is currently disabled'
      case 'email_address_invalid':
        return 'Please enter a valid email address'
      case 'password_too_short':
        return 'Password must be at least 6 characters long'
      case 'user_already_exists':
        return 'An account with this email already exists'
      case 'weak_password':
        return 'Password is too weak. Please choose a stronger password'
      default:
        return error.message || 'An unexpected error occurred'
    }
  },
}

export default supabase