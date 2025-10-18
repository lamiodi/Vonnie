import { createClient } from '@supabase/supabase-js'

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL environment variable is required')
}

if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY environment variable is required')
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-vonne-x2x-auth-token',
  },
  global: {
    headers: {
      'x-application-name': 'vonne-x2x-frontend',
    },
  },
  db: {
    schema: 'public',
  },
})

// Helper functions for common operations

export const auth = {
  // Get current user
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  },

  // Get current session
  getSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
  },

  // Sign up with additional user data
  signUp: async (email, password, userData = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          ...userData,
          created_at: new Date().toISOString(),
        },
      },
    })
    if (error) throw error
    return data
  },

  // Sign in
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  },

  // Sign out
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  // Reset password
  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  },

  // Update password
  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    })
    if (error) throw error
  },

  // Update user metadata
  updateUserMetadata: async (metadata) => {
    const { data, error } = await supabase.auth.updateUser({
      data: metadata,
    })
    if (error) throw error
    return data
  },
}

// Database helper functions

export const db = {
  // Generic query helper
  query: async (table, query = '*', options = {}) => {
    let queryBuilder = supabase.from(table).select(query)

    // Apply filters
    if (options.filters) {
      Object.entries(options.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryBuilder = queryBuilder.eq(key, value)
        }
      })
    }

    // Apply ordering
    if (options.orderBy) {
      queryBuilder = queryBuilder.order(options.orderBy.column, {
        ascending: options.orderBy.ascending !== false,
      })
    }

    // Apply pagination
    if (options.range) {
      queryBuilder = queryBuilder.range(options.range.from, options.range.to)
    }

    const { data, error } = await queryBuilder
    if (error) throw error
    return data
  },

  // Insert record
  insert: async (table, data) => {
    const { data: result, error } = await supabase.from(table).insert(data).select()
    if (error) throw error
    return result
  },

  // Update record
  update: async (table, id, data) => {
    const { data: result, error } = await supabase
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
    if (error) throw error
    return result
  },

  // Delete record
  delete: async (table, id) => {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  },

  // Get single record by ID
  getById: async (table, id) => {
    const { data, error } = await supabase.from(table).select('*').eq('id', id).single()
    if (error) throw error
    return data
  },

  // Get all records
  getAll: async (table) => {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw error
    return data
  },
}

// Storage helper functions

export const storage = {
  // Upload file
  upload: async (bucket, filePath, file) => {
    const { data, error } = await supabase.storage.from(bucket).upload(filePath, file)
    if (error) throw error
    return data
  },

  // Get public URL
  getPublicUrl: (bucket, filePath) => {
    return supabase.storage.from(bucket).getPublicUrl(filePath)
  },

  // Download file
  download: async (bucket, filePath) => {
    const { data, error } = await supabase.storage.from(bucket).download(filePath)
    if (error) throw error
    return data
  },

  // List files
  list: async (bucket, path = '') => {
    const { data, error } = await supabase.storage.from(bucket).list(path)
    if (error) throw error
    return data
  },

  // Delete file
  delete: async (bucket, filePath) => {
    const { data, error } = await supabase.storage.from(bucket).remove([filePath])
    if (error) throw error
    return data
  },
}

// Realtime subscriptions

export const realtime = {
  // Subscribe to table changes
  subscribe: (table, event, callback) => {
    return supabase
      .channel('table-changes')
      .on('postgres_changes', { event: event, schema: 'public', table: table }, callback)
      .subscribe()
  },

  // Unsubscribe from channel
  unsubscribe: (subscription) => {
    return supabase.removeChannel(subscription)
  },
}

export default supabase