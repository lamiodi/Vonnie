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
      message = error.response.data.error;
    } else if (error.response?.data?.message) {
      message = error.response.data.message;
    } else if (error.message) {
      message = error.message;
    } else if (error.response?.status) {
      switch (error.response.status) {
        case 400:
          message = 'Bad request. Please check your input and try again.';
          break;
        case 401:
          message = 'Unauthorized. Please login again.';
          break;
        case 403:
          message = 'Access denied. You don\'t have permission to perform this action.';
          break;
        case 404:
          message = 'Resource not found.';
          break;
        case 409:
          message = 'Conflict. This action cannot be completed due to a conflict.';
          break;
        case 500:
          message = 'Server error. Please try again later.';
          break;
        default:
          message = 'An unexpected error occurred. Please try again.';
      }
    } else {
      message = 'An unexpected error occurred. Please try again.';
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