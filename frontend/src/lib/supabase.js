// API Configuration for Vonne X2x Management System
// This file provides API utilities for communicating with the backend

// Get API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

// Generic API call helper
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
};

// Authentication helper functions
export const auth = {
  // Get current user profile
  getCurrentUser: async () => {
    try {
      const data = await apiCall('/auth/profile');
      return data.user;
    } catch (error) {
      throw error;
    }
  },

  // Sign up with user data
  signUp: async (email, password, userData = {}) => {
    try {
      const data = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone: userData.phone,
          role: userData.role || 'staff'
        }),
      });
      
      // Store token
      localStorage.setItem('auth_token', data.token);
      return data;
    } catch (error) {
      throw error;
    }
  },

  // Sign in
  signIn: async (email, password) => {
    try {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
        }),
      });
      
      // Store token
      localStorage.setItem('auth_token', data.token);
      return data;
    } catch (error) {
      throw error;
    }
  },

  // Sign out
  signOut: async () => {
    localStorage.removeItem('auth_token');
  },

  // Reset password
  resetPassword: async (email) => {
    try {
      const data = await apiCall('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return data;
    } catch (error) {
      throw error;
    }
  },

  // Update password
  updatePassword: async (currentPassword, newPassword) => {
    try {
      const data = await apiCall('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      return data;
    } catch (error) {
      throw error;
    }
  },

  // Update user profile
  updateProfile: async (updates) => {
    try {
      const data = await apiCall('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      return data;
    } catch (error) {
      throw error;
    }
  },
};

// Database helper functions
export const db = {
  // Generic query helper
  query: async (table, query = '*', options = {}) => {
    try {
      let endpoint = `/${table}`;
      const params = new URLSearchParams();
      
      // Apply filters
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, value);
          }
        });
      }

      // Apply ordering
      if (options.orderBy) {
        params.append('order_by', options.orderBy.column);
        params.append('order_direction', options.orderBy.ascending !== false ? 'asc' : 'desc');
      }

      // Apply pagination
      if (options.range) {
        params.append('offset', options.range.from);
        params.append('limit', options.range.to - options.range.from + 1);
      }

      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const data = await apiCall(endpoint);
      return data;
    } catch (error) {
      throw error;
    }
  },

  // Insert record
  insert: async (table, data) => {
    try {
      const result = await apiCall(`/${table}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return result;
    } catch (error) {
      throw error;
    }
  },

  // Update record
  update: async (table, id, data) => {
    try {
      const result = await apiCall(`/${table}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return result;
    } catch (error) {
      throw error;
    }
  },

  // Delete record
  delete: async (table, id) => {
    try {
      await apiCall(`/${table}/${id}`, {
        method: 'DELETE',
      });
    } catch (error) {
      throw error;
    }
  },

  // Get single record by ID
  getById: async (table, id) => {
    try {
      const data = await apiCall(`/${table}/${id}`);
      return data;
    } catch (error) {
      throw error;
    }
  },

  // Get all records
  getAll: async (table) => {
    try {
      const data = await apiCall(`/${table}`);
      return data;
    } catch (error) {
      throw error;
    }
  },
};

// Note: File storage and realtime features are not implemented in the custom backend
// These functions are kept for compatibility but will need backend implementation

export const storage = {
  // Upload file - requires backend implementation
  upload: async (bucket, filePath, file) => {
    throw new Error('File upload not implemented in custom backend');
  },

  // Get public URL - requires backend implementation
  getPublicUrl: (bucket, filePath) => {
    throw new Error('Public URL generation not implemented in custom backend');
  },

  // Download file - requires backend implementation
  download: async (bucket, filePath) => {
    throw new Error('File download not implemented in custom backend');
  },

  // List files - requires backend implementation
  list: async (bucket, path = '') => {
    throw new Error('File listing not implemented in custom backend');
  },

  // Delete file - requires backend implementation
  delete: async (bucket, filePath) => {
    throw new Error('File deletion not implemented in custom backend');
  },
};

// Realtime subscriptions - requires backend implementation

export const realtime = {
  // Subscribe to table changes - requires backend implementation
  subscribe: (table, event, callback) => {
    throw new Error('Realtime subscriptions not implemented in custom backend');
  },

  // Unsubscribe from channel - requires backend implementation
  unsubscribe: (subscription) => {
    throw new Error('Realtime unsubscribe not implemented in custom backend');
  },
};