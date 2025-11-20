/**
 * Enhanced error handler with retry logic and network error recovery
 * Integrates with retryHandler for intelligent error handling
 */

import { toast } from 'react-hot-toast';
import { withRetry, classifyNetworkError, createRetryableApiCall } from './retryHandler';

/**
 * Enhanced error handler with automatic retry logic
 * @param {Error} error - The error object
 * @param {string} customMessage - Custom error message
 * @param {Object} retryConfig - Configuration for retry behavior
 * @returns {Promise<string>} Error message that was displayed to user
 */
export const handleErrorWithRetry = async (error, customMessage = null, retryConfig = {}) => {
  console.error('Application error:', error);
  
  // Classify the error for appropriate handling
  const errorClassification = classifyNetworkError(error);
  
  let message = customMessage || errorClassification.userMessage;
  
  // If it's a retryable network error, suggest retrying
  if (errorClassification.shouldRetry && !customMessage) {
    message += ' You can try again in a few moments.';
  }
  
  // Show error toast with retry suggestion
  toast.error(message, {
    duration: 5000,
    position: 'top-right',
  });
  
  return message;
};

/**
 * Execute an async operation with enhanced error handling and retry logic
 * @param {Function} operation - Async function to execute
 * @param {Object} options - Options for error handling and retry
 * @returns {Promise<any>} Result of the operation
 */
export const executeWithErrorHandling = async (operation, options = {}) => {
  const {
    operationName = 'operation',
    retryConfig = {},
    onError = null,
    showToast = true,
    fallbackValue = null
  } = options;
  
  try {
    // Execute with retry logic
    const result = await withRetry(operation, retryConfig, operationName);
    return result;
  } catch (error) {
    // Handle the error with user-friendly messaging
    const errorMessage = await handleErrorWithRetry(error, null, retryConfig);
    
    // Call custom error handler if provided
    if (onError) {
      onError(error, errorMessage);
    }
    
    // Return fallback value if provided
    if (fallbackValue !== null) {
      console.log(`🔄 Returning fallback value for ${operationName}`);
      return fallbackValue;
    }
    
    // Re-throw the error if no fallback
    throw error;
  }
};

/**
 * Enhanced API request handler with automatic retry and error recovery
 * @param {Function} apiCall - API call function
 * @param {Object} options - Request options
 * @returns {Promise<any>} API response
 */
export const makeApiRequest = async (apiCall, options = {}) => {
  const {
    showLoading = true,
    loadingMessage = 'Processing...',
    successMessage = null,
    errorMessage = null,
    retryConfig = {},
    onSuccess = null,
    onError = null
  } = options;
  
  let loadingToast = null;
  
  try {
    // Show loading toast if requested
    if (showLoading) {
      loadingToast = toast.loading(loadingMessage);
    }
    
    // Create retryable API call
    const retryableApiCall = createRetryableApiCall(apiCall, retryConfig);
    
    // Execute the API call
    const result = await retryableApiCall();
    
    // Dismiss loading toast and show success
    if (loadingToast) {
      toast.dismiss(loadingToast);
    }
    
    if (successMessage) {
      toast.success(successMessage);
    }
    
    // Call success callback if provided
    if (onSuccess) {
      onSuccess(result);
    }
    
    return result;
    
  } catch (error) {
    // Dismiss loading toast
    if (loadingToast) {
      toast.dismiss(loadingToast);
    }
    
    // Handle the error
    const message = await handleErrorWithRetry(error, errorMessage, retryConfig);
    
    // Call error callback if provided
    if (onError) {
      onError(error, message);
    }
    
    throw error;
  }
};

/**
 * Network connectivity checker
 * @returns {Promise<boolean>} Whether network is available
 */
export const checkNetworkConnectivity = async () => {
  try {
    // Try to reach a reliable endpoint (you can replace with your health check endpoint)
    const response = await fetch('/api/health', {
      method: 'HEAD',
      timeout: 5000
    });
    return response.ok;
  } catch (error) {
    console.warn('Network connectivity check failed:', error.message);
    return false;
  }
};

/**
 * Enhanced error handler (original function enhanced with retry suggestions)
 */
export const handleError = (error, customMessage = null) => {
  // Use the enhanced version with retry logic
  return handleErrorWithRetry(error, customMessage);
};

/**
 * Success notification handler (unchanged)
 */
export const handleSuccess = (message) => {
  toast.success(message);
};

/**
 * Loading notification handler (unchanged)
 */
export const handleLoading = (message) => {
  return toast.loading(message);
};

/**
 * Dismiss a specific toast (unchanged)
 */
export const dismissToast = (toastId) => {
  if (toastId) {
    toast.dismiss(toastId);
  }
};

/**
 * Promise-based toast handler for async operations (enhanced with retry)
 */
export const handlePromise = (promise, messages) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading || 'Processing...',
      success: messages.success || 'Operation completed successfully!',
      error: (err) => {
        const errorClassification = classifyNetworkError(err);
        return messages.error || errorClassification.userMessage;
      },
    }
  );
};

/**
 * Network error handler (enhanced)
 */
export const handleNetworkError = () => {
  toast.error('Network error. Please check your internet connection and try again.', {
    duration: 6000,
  });
};

/**
 * Validation error handler (unchanged)
 */
export const handleValidationError = (errors) => {
  if (Array.isArray(errors)) {
    errors.forEach(error => toast.error(error));
  } else if (typeof errors === 'object') {
    Object.values(errors).forEach(error => {
      if (Array.isArray(error)) {
        error.forEach(msg => toast.error(msg));
      } else {
        toast.error(error);
      }
    });
  } else {
    toast.error(errors);
  }
};