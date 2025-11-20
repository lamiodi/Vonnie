/**
 * Reusable React Hooks for Frontend Components
 * Provides common state management and utility hooks
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for managing loading states and API calls with enhanced error handling
 * @param {Function} apiCall - The API function to call
 * @param {Array} dependencies - Dependencies for useEffect
 * @param {Object} options - Configuration options for error handling and retry
 * @returns {Object} Loading state, data, error, and refetch function
 */
export function useApi(apiCall, dependencies = [], options = {}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  const {
    showToast = true,
    retryConfig = {},
    onError = null,
    onSuccess = null,
    fallbackData = null
  } = options;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Execute API call with enhanced error handling if available
      let result;
      if (apiCall.name && apiCall.name.includes('Enhanced')) {
        // If it's an enhanced API call, use it directly
        result = await apiCall();
      } else {
        // Otherwise, wrap it with enhanced error handling
        try {
          const { executeWithErrorHandling } = await import('./enhancedErrorHandler');
          result = await executeWithErrorHandling(apiCall, {
            operationName: 'API call',
            retryConfig,
            showToast,
            fallbackValue: fallbackData,
            onError: (error, message) => {
              setError(message);
              if (onError) onError(error, message);
            }
          });
        } catch (err) {
          // Fallback to basic error handling if enhanced handler fails
          result = await apiCall();
        }
      }
      
      setData(result);
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      
      if (onError) {
        onError(err, errorMessage);
      }
      
      // Return fallback data if available
      if (fallbackData !== null) {
        setData(fallbackData);
        return fallbackData;
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiCall, showToast, retryConfig, onError, onSuccess, fallbackData]);

  useEffect(() => {
    fetchData();
  }, dependencies);

  return { loading, data, error, refetch: fetchData };
}

/**
 * Hook for managing form state and validation
 * @param {Object} initialValues - Initial form values
 * @param {Function} validate - Validation function
 * @returns {Object} Form state and handlers
 */
export function useForm(initialValues = {}, validate = null) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const handleChange = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  }, [errors]);

  const handleBlur = useCallback((name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    
    // Run validation on blur if provided
    if (validate) {
      const validationErrors = validate(values);
      setErrors(validationErrors);
    }
  }, [values, validate]);

  const handleSubmit = useCallback((onSubmit) => {
    return async (e) => {
      e.preventDefault();
      
      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {});
      setTouched(allTouched);
      
      // Run validation if provided
      if (validate) {
        const validationErrors = validate(values);
        setErrors(validationErrors);
        
        if (Object.keys(validationErrors).some(key => validationErrors[key])) {
          return;
        }
      }
      
      await onSubmit(values);
    };
  }, [values, validate]);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setValues
  };
}

/**
 * Hook for managing modal state
 * @param {boolean} initialState - Initial modal state
 * @returns {Object} Modal state and controls
 */
export function useModal(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return { isOpen, open, close, toggle };
}

/**
 * Hook for managing search functionality
 * @param {Array} data - Data to search through
 * @param {Function} searchFunction - Custom search function (optional)
 * @returns {Object} Search state and results
 */
export function useSearch(data = [], searchFunction = null) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredData, setFilteredData] = useState(data);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredData(data);
      return;
    }

    const term = searchTerm.toLowerCase();
    
    if (searchFunction) {
      setFilteredData(searchFunction(data, term));
    } else {
      // Default search: looks in all string values
      const filtered = data.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(term)
        )
      );
      setFilteredData(filtered);
    }
  }, [data, searchTerm, searchFunction]);

  return { searchTerm, setSearchTerm, filteredData };
}

/**
 * Hook for managing pagination
 * @param {Array} data - Full dataset
 * @param {number} itemsPerPage - Items per page
 * @returns {Object} Pagination state and controls
 */
export function usePagination(data = [], itemsPerPage = 10) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = data.slice(startIndex, endIndex);

  const goToPage = useCallback((page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  const resetPagination = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    totalPages,
    currentData,
    goToPage,
    nextPage,
    prevPage,
    resetPagination
  };
}

/**
 * Hook for managing local storage
 * @param {string} key - Storage key
 * @param {any} initialValue - Initial value
 * @returns {Object} Storage value and setter
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue];
}

/**
 * Hook for debouncing values
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {any} Debounced value
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for managing loading states with timeout
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Object} Loading state and controls
 */
export function useLoadingWithTimeout(timeout = 30000) {
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  const startLoading = useCallback(() => {
    setLoading(true);
    setTimedOut(false);
    
    const timeoutId = setTimeout(() => {
      setTimedOut(true);
      setLoading(false);
    }, timeout);

    return () => clearTimeout(timeoutId);
  }, [timeout]);

  const stopLoading = useCallback(() => {
    setLoading(false);
    setTimedOut(false);
  }, []);

  return { loading, timedOut, startLoading, stopLoading };
}