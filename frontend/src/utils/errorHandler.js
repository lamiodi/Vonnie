import { toast } from 'react-hot-toast';

/**
 * Centralized error handler for API requests and application errors
 */
export const handleError = (error, customMessage = null) => {
  console.error('Application error:', error);
  
  let message = customMessage;
  
  if (!message) {
    // Extract error message from different error types
    if (error.response?.data?.error) {
      // Handle standard API error objects
      if (typeof error.response.data.error === 'object') {
        message = error.response.data.error.message || 'An error occurred';
      } else {
        message = error.response.data.error;
      }
    } else if (error.response?.data?.message) {
      message = error.response.data.message;
    } else if (error.message) {
      message = error.message;
    } else if (error.response?.status) {
      switch (error.response.status) {
        case 400:
          message = 'The information provided is invalid. Please check your input and try again.';
          break;
        case 401:
          message = 'Your session has expired. Please log in again to continue.';
          break;
        case 403:
          message = 'You do not have permission to access this resource.';
          break;
        case 404:
          message = 'The requested resource was not found.';
          break;
        case 409:
          message = 'This action conflicts with the current state. Please refresh and try again.';
          break;
        case 429:
          message = 'Too many requests. Please wait a moment before trying again.';
          break;
        case 500:
          message = 'A server error occurred. Our team has been notified. Please try again later.';
          break;
        default:
          message = 'An unexpected error occurred. Please try again.';
      }
    } else {
      message = 'Unable to connect to the server. Please check your internet connection.';
    }
  }
  
  toast.error(message);
  return message;
};

/**
 * Success notification handler
 */
export const handleSuccess = (message) => {
  toast.success(message);
};

/**
 * Loading notification handler
 */
export const handleLoading = (message) => {
  return toast.loading(message);
};

/**
 * Dismiss a specific toast
 */
export const dismissToast = (toastId) => {
  if (toastId) {
    toast.dismiss(toastId);
  }
};

/**
 * Promise-based toast handler for async operations
 */
export const handlePromise = (promise, messages) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading || 'Processing...',
      success: messages.success || 'Operation completed successfully!',
      error: (err) => messages.error || handleError(err),
    }
  );
};

/**
 * Network error handler
 */
export const handleNetworkError = () => {
  toast.error('Network error. Please check your internet connection and try again.');
};

/**
 * Validation error handler
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