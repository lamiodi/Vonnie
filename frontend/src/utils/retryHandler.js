/**
 * Exponential backoff retry utility for network requests
 * Handles transient failures and network errors with intelligent retry logic
 */

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  networkErrorMessages: ['network error', 'failed to fetch', 'timeout', 'econnrefused', 'ENOTFOUND']
};

/**
 * Check if an error is retryable based on status code or error message
 * @param {Error} error - The error object
 * @param {Object} config - Retry configuration
 * @returns {boolean} Whether the error is retryable
 */
function isRetryableError(error, config = DEFAULT_RETRY_CONFIG) {
  // Check for network errors
  if (error.message) {
    const errorMessage = error.message.toLowerCase();
    const isNetworkError = config.networkErrorMessages.some(msg => 
      errorMessage.includes(msg.toLowerCase())
    );
    if (isNetworkError) return true;
  }

  // Check for retryable HTTP status codes
  if (error.response?.status) {
    return config.retryableStatusCodes.includes(error.response.status);
  }

  // Check for specific axios errors
  if (error.code) {
    return ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'].includes(error.code);
  }

  return false;
}

/**
 * Calculate delay with exponential backoff and jitter
 * @param {number} attemptNumber - Current attempt number (0-based)
 * @param {Object} config - Retry configuration
 * @returns {number} Delay in milliseconds
 */
function calculateDelay(attemptNumber, config = DEFAULT_RETRY_CONFIG) {
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attemptNumber);
  const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add jitter
  return Math.min(jitteredDelay, config.maxDelay);
}

/**
 * Sleep utility function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after specified time
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an async function with exponential backoff retry logic
 * @param {Function} fn - Async function to execute
 * @param {Object} config - Retry configuration
 * @param {string} operationName - Name of the operation for logging
 * @returns {Promise} Result of the function execution
 */
export async function withRetry(fn, config = DEFAULT_RETRY_CONFIG, operationName = 'operation') {
  const effectiveConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError;

  for (let attempt = 0; attempt <= effectiveConfig.maxRetries; attempt++) {
    try {
      console.log(`🔄 Attempting ${operationName} (attempt ${attempt + 1}/${effectiveConfig.maxRetries + 1})`);
      const result = await fn();
      
      if (attempt > 0) {
        console.log(`✅ ${operationName} succeeded after ${attempt + 1} attempts`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (attempt < effectiveConfig.maxRetries && isRetryableError(error, effectiveConfig)) {
        const delay = calculateDelay(attempt, effectiveConfig);
        console.warn(`⚠️ ${operationName} failed (attempt ${attempt + 1}): ${error.message}. Retrying in ${delay}ms...`);
        
        await sleep(delay);
        continue;
      }
      
      // If it's not retryable or we've exhausted retries, throw the error
      console.error(`❌ ${operationName} failed after ${attempt + 1} attempts: ${error.message}`);
      throw error;
    }
  }

  // This should never be reached, but just in case
  throw lastError;
}

/**
 * Create a retry wrapper for API calls with automatic error handling
 * @param {Function} apiCall - API call function
 * @param {Object} config - Retry configuration
 * @returns {Function} Wrapped API call function
 */
export function createRetryableApiCall(apiCall, config = DEFAULT_RETRY_CONFIG) {
  return async function(...args) {
    return withRetry(
      () => apiCall(...args),
      config,
      apiCall.name || 'API call'
    );
  };
}

/**
 * Network error detector with user-friendly messages
 * @param {Error} error - The error object
 * @returns {Object} Error classification and user message
 */
export function classifyNetworkError(error) {
  if (!error) {
    return {
      type: 'unknown',
      userMessage: 'An unexpected error occurred. Please try again.',
      shouldRetry: false
    };
  }

  // Network connectivity issues
  if (error.message?.toLowerCase().includes('network error') || 
      error.code === 'ECONNREFUSED' || 
      error.code === 'ENOTFOUND') {
    return {
      type: 'network_connectivity',
      userMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      shouldRetry: true
    };
  }

  // Timeout issues
  if (error.code === 'ETIMEDOUT' || error.response?.status === 408) {
    return {
      type: 'timeout',
      userMessage: 'The request is taking longer than expected. Please try again.',
      shouldRetry: true
    };
  }

  // Server errors
  if (error.response?.status >= 500) {
    return {
      type: 'server_error',
      userMessage: 'The server is temporarily unavailable. Please try again in a few moments.',
      shouldRetry: true
    };
  }

  // Rate limiting
  if (error.response?.status === 429) {
    return {
      type: 'rate_limit',
      userMessage: 'Too many requests. Please wait a moment and try again.',
      shouldRetry: true
    };
  }

  // Client errors (4xx) - don't retry
  if (error.response?.status >= 400 && error.response?.status < 500) {
    return {
      type: 'client_error',
      userMessage: error.response.data?.error || 'Invalid request. Please check your input and try again.',
      shouldRetry: false
    };
  }

  return {
    type: 'unknown',
    userMessage: 'An unexpected error occurred. Please try again.',
    shouldRetry: true
  };
}