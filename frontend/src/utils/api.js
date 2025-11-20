/**
 * API Service Utilities for Frontend
 * Provides reusable API call functions and error handling
 */

import axios from 'axios';

// Base API configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5010/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for standardized error handling
api.interceptors.response.use(
  (response) => {
    // Handle standardized success response format
    if (response.data && response.data.success === true) {
      return response.data;
    }
    
    // Handle legacy responses (convert to standardized format)
    if (Array.isArray(response.data) || (typeof response.data === 'object' && !response.data.success)) {
      return {
        success: true,
        data: response.data,
        message: 'Operation successful',
        status: response.status,
        timestamp: new Date().toISOString()
      };
    }
    
    return response;
  },
  (error) => {
    // Handle standardized error response format
    if (error.response?.data?.success === false) {
      return Promise.reject(error.response.data);
    }
    
    // Convert legacy error responses to standardized format
    const status = error.response?.status || 500;
    let errorData = {
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: error.response?.data?.error || error.response?.data?.message || error.message || 'Server error'
      },
      status,
      timestamp: new Date().toISOString()
    };
    
    // Add field validation errors if available
    if (error.response?.data?.errors) {
      errorData.error.details = error.response.data.errors;
    }
    
    return Promise.reject(errorData);
  }
);

// Export API base URL for use in other components
export const API_BASE_URL = import.meta.env.VITE_API_URL;

/**
 * Generic API request function with enhanced error handling and exponential backoff retry
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Request options
 * @param {Object} retryConfig - Retry configuration (optional)
 * @returns {Promise} API response
 */
async function apiRequest(endpoint, options = {}, retryConfig = {}) {
  try {
    // Prevent double '/api' in final URL when baseURL already includes '/api'
    let cleanedEndpoint = endpoint;
    const baseUrl = import.meta.env.VITE_API_URL || '';
    if (typeof endpoint === 'string' && baseUrl.endsWith('/api') && endpoint.startsWith('/api')) {
      cleanedEndpoint = endpoint.replace(/^\/api/, ''); // remove leading /api to avoid duplication
    }
    
    // Import retry handler dynamically to avoid circular dependencies
    const { withRetry } = await import('./retryHandler');
    
    // Execute API call with exponential backoff retry logic
    const response = await withRetry(
      async () => {
        const response = await api(cleanedEndpoint, options);
        return response;
      },
      {
        maxRetries: retryConfig.maxRetries || 3,
        initialDelay: retryConfig.initialDelay || 1000,
        maxDelay: retryConfig.maxDelay || 30000,
        backoffMultiplier: retryConfig.backoffMultiplier || 2,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        networkErrorMessages: ['network error', 'failed to fetch', 'timeout', 'econnrefused', 'ENOTFOUND'],
        ...retryConfig
      },
      `API request to ${endpoint}`
    );
    
    return response.data;
  } catch (error) {
    console.error(`API request failed after retries: ${endpoint}`, error);
    throw error;
  }
}

/**
 * GET request helper
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @returns {Promise} API response
 */
export async function apiGet(endpoint, params = {}) {
  return apiRequest(endpoint, {
    method: 'GET',
    params
  });
}

/**
 * POST request helper
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request body data
 * @returns {Promise} API response
 */
export async function apiPost(endpoint, data = {}) {
  return apiRequest(endpoint, {
    method: 'POST',
    data
  });
}

/**
 * PUT request helper
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request body data
 * @returns {Promise} API response
 */
export async function apiPut(endpoint, data = {}) {
  return apiRequest(endpoint, {
    method: 'PUT',
    data
  });
}

/**
 * PATCH request helper
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request body data
 * @returns {Promise} API response
 */
export async function apiPatch(endpoint, data = {}) {
  return apiRequest(endpoint, {
    method: 'PATCH',
    data
  });
}

/**
 * DELETE request helper
 * @param {string} endpoint - API endpoint
 * @returns {Promise} API response
 */
export async function apiDelete(endpoint) {
  return apiRequest(endpoint, { method: 'DELETE' });
}

/**
 * File upload helper
 * @param {string} endpoint - API endpoint
 * @param {File} file - File to upload
 * @param {Object} additionalData - Additional form data
 * @returns {Promise} API response
 */
export async function apiUpload(endpoint, file, additionalData = {}) {
  const formData = new FormData();
  formData.append('file', file);
  
  Object.keys(additionalData).forEach(key => {
    formData.append(key, additionalData[key]);
  });

  return apiRequest(endpoint, {
    method: 'POST',
    data: formData,
    headers: {} // Let axios set Content-Type for FormData
  });
}

/**
 * Batch API request helper
 * @param {Array} requests - Array of request configurations
 * @returns {Promise} Array of responses
 */
export async function apiBatch(requests) {
  try {
    const promises = requests.map(({ endpoint, method = 'GET', data = {} }) => {
      switch (method.toUpperCase()) {
        case 'GET':
          return apiGet(endpoint, data);
        case 'POST':
          return apiPost(endpoint, data);
        case 'PUT':
          return apiPut(endpoint, data);
        case 'PATCH':
          return apiPatch(endpoint, data);
        case 'DELETE':
          return apiDelete(endpoint);
        default:
          throw new Error(`Unsupported method: ${method}`);
      }
    });

    const responses = await Promise.allSettled(promises);

    return responses.map((result, index) => ({
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null,
      endpoint: requests[index].endpoint
    }));
  } catch (error) {
    console.error('Batch API request failed:', error);
    throw error;
  }
}

/**
 * API endpoints configuration
 */
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  PROFILE: '/api/auth/profile',
  
  // Inventory
  INVENTORY: '/inventory',
  INVENTORY_BARCODE: (barcode) => `/inventory/barcode/${barcode}`,
  INVENTORY_CATEGORIES: '/inventory/categories',
  
  // Services
  SERVICES: '/services',
  PUBLIC_SERVICES: '/public/services',
  
  // Bookings
  BOOKINGS: '/bookings',
  BOOKING_SLOTS: '/api/bookings/available-slots',
  PUBLIC_BOOKING_SLOTS: '/api/public/bookings/available-slots',
  BOOKING_ASSIGN: (id) => `/bookings/${id}/assign-worker`,
  BOOKING_ASSIGN_WORKERS: (id) => `/bookings/${id}/assign-workers`,
  BOOKING_PAYMENT_STATUS: (id) => `/bookings/${id}/payment-status`,
  BOOKING_WAIT_TIME: (id) => `/bookings/${id}/wait-time`,
  BOOKING_WORKERS: (id) => `/bookings/${id}/workers`,
  BOOKING_APPROVE: (id) => `/bookings/${id}/approve`,
  
  // POS
  POS_CHECKOUT: '/pos/checkout',
  POS_COUPON: '/pos/apply-coupon',
  POS_TRANSACTIONS: '/pos/transactions',
  POS_TRANSACTIONS_PENDING: '/pos/transactions/pending-verification',
  POS_TRANSACTION_VERIFY: (id) => `/pos/transactions/${id}/verify-payment`,
  POS_TRANSACTION_DETAILS: (id) => `/pos/transactions/${id}`,
  
  // Workers
  WORKERS: '/workers',
  PUBLIC_WORKERS: '/public/workers',
  WORKER_SCHEDULE: (id) => `/workers/${id}/schedule`,
  
  // Attendance
  ATTENDANCE: '/attendance',
  ATTENDANCE_CHECKIN: '/attendance/checkin',
  ATTENDANCE_CHECKOUT: '/attendance/checkout',
  ATTENDANCE_VERIFY: '/attendance/verify-location',
  
  // Reports
  REPORTS_SALES: '/reports/sales',
  REPORTS_INVENTORY: '/reports/inventory',
  REPORTS_ATTENDANCE: '/reports/attendance',
  REPORTS_BOOKINGS: '/reports/bookings',
  REPORTS_COUPONS: '/reports/coupons',
  
  // Analytics
  ANALYTICS_DASHBOARD: '/analytics/dashboard',
  ANALYTICS_EXPORT: '/analytics/export',
  
  // Coupons
  COUPONS: '/coupons',
  COUPON_VALIDATE: (code) => `/coupons/validate/${code}`,
  COUPON_USE: '/coupons/use',
  COUPON_DEACTIVATE: (id) => `/coupons/${id}/deactivate`,
  COUPON_USAGE_HISTORY: '/coupons/usage-history',
  
  // Admin
  ADMIN_SIGNUP_STATUS: '/admin/signup-status',
  
  // Queue
  QUEUE_TODAY: '/queue/today',

  // Payment and Booking Confirmation
  PAYMENT_VERIFY: '/public/payment/verify',
  BOOKING_CONFIRMATION: '/public/bookings/confirmation',
};

/**
 * Common error messages
 */
export const API_ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNAUTHORIZED: 'Unauthorized. Please log in again.',
  FORBIDDEN: 'Access denied. You do not have permission.',
  NOT_FOUND: 'Resource not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  TIMEOUT: 'Request timed out. Please try again.'
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if user has valid token
 */
export function isAuthenticated() {
  const token = localStorage.getItem('token');
  return !!token;
}

/**
 * Get appropriate endpoint based on authentication status
 * @param {string} authenticatedEndpoint - Endpoint for authenticated users
 * @param {string} publicEndpoint - Public endpoint alternative
 * @returns {string} Selected endpoint
 */
export function getEndpoint(authenticatedEndpoint, publicEndpoint) {
  return isAuthenticated() ? authenticatedEndpoint : publicEndpoint;
}

/**
 * Handle common API errors with enhanced error classification and user-friendly messages
 * @param {Error} error - Error object
 * @param {Function} onUnauthorized - Callback for unauthorized errors
 * @returns {string} User-friendly error message
 */
export function handleApiError(error, onUnauthorized = null) {
  // Handle standardized error responses from backend
  if (error.error) {
    const backendError = error.error;
    
    // Handle unauthorized errors
    if (error.status === 401 || backendError.code === 'UNAUTHORIZED') {
      if (onUnauthorized) onUnauthorized();
      return backendError.message || API_ERROR_MESSAGES.UNAUTHORIZED;
    }
    
    // Handle specific backend error codes
    switch (backendError.code) {
      case 'EMAIL_ALREADY_EXISTS':
        return 'This email address is already registered. Please use a different email.';
      case 'INVALID_EMAIL':
        return 'Please enter a valid email address.';
      case 'INVALID_PASSWORD':
        return 'Password must be at least 6 characters long.';
      case 'MISSING_REQUIRED_FIELDS':
        return 'Please fill in all required fields.';
      case 'BOOKING_CONFLICT':
        return 'This time slot is already booked. Please choose a different time.';
      case 'WORKER_UNAVAILABLE':
        return 'The selected worker is not available at this time.';
      case 'INVALID_SERVICE_PRICE':
        return 'Invalid service price. Please check the pricing and try again.';
      default:
        return backendError.message || API_ERROR_MESSAGES.SERVER_ERROR;
    }
  }
  
  // Handle network and HTTP errors
  if (error.response?.status === 401) {
    if (onUnauthorized) onUnauthorized();
    return API_ERROR_MESSAGES.UNAUTHORIZED;
  }
  
  if (error.code === 'ERR_NETWORK') {
    return API_ERROR_MESSAGES.NETWORK_ERROR;
  }
  
  if (error.code === 'ECONNABORTED') {
    return API_ERROR_MESSAGES.TIMEOUT;
  }
  
  if (error.response?.status === 404) {
    return API_ERROR_MESSAGES.NOT_FOUND;
  }
  
  if (error.response?.status === 403) {
    return API_ERROR_MESSAGES.FORBIDDEN;
  }
  
  // Handle validation errors
  if (error.error?.details) {
    const validationErrors = error.error.details;
    if (Array.isArray(validationErrors)) {
      return validationErrors.join('. ');
    } else if (typeof validationErrors === 'object') {
      return Object.values(validationErrors).flat().join('. ');
    }
  }
  
  // Use enhanced error classification for better user messages
  if (typeof window !== 'undefined' && window.import) {
    // Import retry handler dynamically to avoid circular dependencies
    import('./retryHandler').then(({ classifyNetworkError }) => {
      const classification = classifyNetworkError(error);
      return classification.userMessage;
    }).catch(() => {
      // Fallback to basic error message if classification fails
      return error.message || API_ERROR_MESSAGES.SERVER_ERROR;
    });
  }
  
  // Return the original error message if it's user-friendly
  return error.message || API_ERROR_MESSAGES.SERVER_ERROR;
}

/**
 * Enhanced API request function with automatic error handling, retry logic, and user notifications
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Request options
 * @param {Object} config - Configuration for error handling and notifications
 * @returns {Promise} API response
 */
export async function apiRequestEnhanced(endpoint, options = {}, config = {}) {
  const {
    showLoading = true,
    loadingMessage = 'Processing...',
    successMessage = null,
    errorMessage = null,
    retryConfig = {},
    onSuccess = null,
    onError = null,
    onUnauthorized = null
  } = config;
  
  let loadingToast = null;
  
  try {
    // Show loading toast if requested
    if (showLoading) {
      // Import toast dynamically to avoid issues in non-browser environments
      const { toast } = await import('react-hot-toast');
      loadingToast = toast.loading(loadingMessage);
    }
    
    // Make the API request with enhanced retry logic
    const result = await apiRequest(endpoint, options, retryConfig);
    
    // Dismiss loading toast and show success
    if (loadingToast && typeof window !== 'undefined') {
      const { toast } = await import('react-hot-toast');
      toast.dismiss(loadingToast);
    }
    
    if (successMessage && typeof window !== 'undefined') {
      const { toast } = await import('react-hot-toast');
      toast.success(successMessage);
    }
    
    // Call success callback if provided
    if (onSuccess) {
      onSuccess(result);
    }
    
    return result;
    
  } catch (error) {
    // Dismiss loading toast
    if (loadingToast && typeof window !== 'undefined') {
      const { toast } = await import('react-hot-toast');
      toast.dismiss(loadingToast);
    }
    
    // Handle the error with enhanced error handling
    const userMessage = handleApiError(error, onUnauthorized);
    
    // Show error toast if in browser environment
    if (typeof window !== 'undefined') {
      const { toast } = await import('react-hot-toast');
      toast.error(errorMessage || userMessage, {
        duration: 5000,
        position: 'top-right',
      });
    }
    
    // Call error callback if provided
    if (onError) {
      onError(error, userMessage);
    }
    
    // Re-throw the error for further handling if needed
    throw error;
  }
}

/**
 * Enhanced GET request helper with automatic error handling
 * @param {string} endpoint - API endpoint
 * @param {Object} params - Query parameters
 * @param {Object} config - Configuration for error handling and notifications
 * @returns {Promise} API response
 */
export async function apiGetEnhanced(endpoint, params = {}, config = {}) {
  return apiRequestEnhanced(endpoint, { method: 'GET', params }, config);
}

/**
 * Enhanced POST request helper with automatic error handling
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request body data
 * @param {Object} config - Configuration for error handling and notifications
 * @returns {Promise} API response
 */
export async function apiPostEnhanced(endpoint, data = {}, config = {}) {
  return apiRequestEnhanced(endpoint, { method: 'POST', data }, config);
}

/**
 * Enhanced PUT request helper with automatic error handling
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request body data
 * @param {Object} config - Configuration for error handling and notifications
 * @returns {Promise} API response
 */
export async function apiPutEnhanced(endpoint, data = {}, config = {}) {
  return apiRequestEnhanced(endpoint, { method: 'PUT', data }, config);
}

/**
 * Enhanced PATCH request helper with automatic error handling
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request body data
 * @param {Object} config - Configuration for error handling and notifications
 * @returns {Promise} API response
 */
export async function apiPatchEnhanced(endpoint, data = {}, config = {}) {
  return apiRequestEnhanced(endpoint, { method: 'PATCH', data }, config);
}

/**
 * Enhanced DELETE request helper with automatic error handling
 * @param {string} endpoint - API endpoint
 * @param {Object} config - Configuration for error handling and notifications
 * @returns {Promise} API response
 */
export async function apiDeleteEnhanced(endpoint, config = {}) {
  return apiRequestEnhanced(endpoint, { method: 'DELETE' }, config);
}

export default api;