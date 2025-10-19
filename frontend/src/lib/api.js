// API Configuration
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'
const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
    VERIFY_EMAIL: '/api/auth/verify-email',
  },
  
  // Users
  USERS: {
    PROFILE: '/api/users/profile',
    UPDATE_PROFILE: '/api/users/profile',
    CHANGE_PASSWORD: '/api/users/change-password',
  },
  
  // Services
  SERVICES: {
    LIST: '/api/services',
    CREATE: '/api/services',
    UPDATE: (id) => `/api/services/${id}`,
    DELETE: (id) => `/api/services/${id}`,
    CATEGORIES: '/api/services/categories',
  },
  
  // Appointments
  APPOINTMENTS: {
    LIST: '/api/appointments',
    CREATE: '/api/appointments',
    UPDATE: (id) => `/api/appointments/${id}`,
    DELETE: (id) => `/api/appointments/${id}`,
    CANCEL: (id) => `/api/appointments/${id}/cancel`,
  },
  
  // Guest Customers
  GUEST_CUSTOMERS: {
    LIST: '/api/guest-customers',
    CREATE: '/api/guest-customers',
    UPDATE: (id) => `/api/guest-customers/${id}`,
    DELETE: (id) => `/api/guest-customers/${id}`,
    SEARCH: '/api/guest-customers/search',
  },
  
  // Payments
  PAYMENTS: {
    INITIALIZE: '/api/payments/initialize',
    VERIFY: (reference) => `/api/payments/verify/${reference}`,
    HISTORY: '/api/payments/history',
    REFUND: (id) => `/api/payments/${id}/refund`,
  },
  
  // Inventory
  INVENTORY: {
    PRODUCTS: '/api/inventory/products',
    CATEGORIES: '/api/inventory/categories',
    SUPPLIERS: '/api/inventory/suppliers',
    STOCK_MOVEMENTS: '/api/inventory/stock-movements',
  },
  
  // Staff
  STAFF: {
    LIST: '/api/staff',
    CREATE: '/api/staff',
    UPDATE: (id) => `/api/staff/${id}`,
    DELETE: (id) => `/api/staff/${id}`,
    DEPARTMENTS: '/api/staff/departments',
    SHIFTS: '/api/staff/shifts',
  },
  
  // Reports
  REPORTS: {
    SALES: '/api/reports/sales',
    ATTENDANCE: '/api/reports/attendance',
    INVENTORY: '/api/reports/inventory',
    FINANCIAL: '/api/reports/financial',
  },
  
  // Settings
  SETTINGS: {
    BUSINESS: '/api/settings/business',
    PAYMENT: '/api/settings/payment',
    NOTIFICATION: '/api/settings/notification',
    SYSTEM: '/api/settings/system',
  },
  
  // Notifications
  NOTIFICATIONS: {
    LIST: '/api/notifications',
    MARK_READ: (id) => `/api/notifications/${id}/read`,
    MARK_ALL_READ: '/api/notifications/mark-all-read',
  },
}

// Helper function to build full URL
export const buildApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`
}

// HTTP client with default configuration
class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    }
  }

  // Get authorization header
  getAuthHeader() {
    const token = localStorage.getItem('token')
    return token ? { 'Authorization': `Bearer ${token}` } : {}
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: {
        ...this.defaultHeaders,
        ...this.getAuthHeader(),
        ...options.headers,
      },
      ...options,
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        return await response.json()
      }
      
      return response
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }

  // HTTP methods
  async get(endpoint, params = {}) {
    const url = new URL(`${this.baseURL}${endpoint}`)
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key])
      }
    })
    
    return this.request(url.pathname + url.search, { method: 'GET' })
  }

  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async patch(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' })
  }

  // File upload method
  async upload(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let browser set it
        ...this.getAuthHeader(),
      },
    })
  }
}

// Create and export API client instance
export const apiClient = new ApiClient()

// Export API endpoints for easy access
export { API_ENDPOINTS, API_BASE_URL }

// Export default
export default {
  apiClient,
  API_ENDPOINTS,
  API_BASE_URL,
  buildApiUrl,
}