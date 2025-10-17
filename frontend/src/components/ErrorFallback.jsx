import React from 'react'
import { useErrorBoundary } from 'react-error-boundary'

const ErrorFallback = ({ error, resetErrorBoundary }) => {
  const isDevelopment = import.meta.env.DEV

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Error Icon */}
        <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
          <svg 
            className="w-8 h-8 text-red-600" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
            />
          </svg>
        </div>

        {/* Error Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Oops! Something went wrong
        </h1>

        {/* Error Description */}
        <p className="text-gray-600 mb-6">
          We're sorry, but something unexpected happened. Our team has been notified and is working to fix this issue.
        </p>

        {/* Error Details (Development Only) */}
        {isDevelopment && error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
            <h3 className="text-sm font-semibold text-red-800 mb-2">
              Error Details (Development Mode)
            </h3>
            <div className="text-xs text-red-700 font-mono break-all">
              <div className="mb-2">
                <strong>Message:</strong> {error.message}
              </div>
              {error.stack && (
                <div>
                  <strong>Stack:</strong>
                  <pre className="mt-1 whitespace-pre-wrap text-xs">
                    {error.stack}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={resetErrorBoundary}
            className="w-full px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            Try Again
          </button>
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            Go to Homepage
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>

        {/* Support Information */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-2">
            If this problem persists, please contact our support team.
          </p>
          <div className="flex justify-center space-x-4 text-sm">
            <a 
              href="mailto:support@vonnex2x.com" 
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Email Support
            </a>
            <span className="text-gray-300">|</span>
            <a 
              href="tel:+2348000000000" 
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Call Support
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// Specialized error fallbacks for different contexts
export const PageErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="min-h-[400px] flex items-center justify-center p-8">
    <div className="max-w-md w-full text-center">
      <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
        <svg 
          className="w-6 h-6 text-red-600" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
          />
        </svg>
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Page Error
      </h3>
      
      <p className="text-gray-600 mb-4">
        This page encountered an error and couldn't load properly.
      </p>
      
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        Retry
      </button>
    </div>
  </div>
)

export const ComponentErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
    <div className="flex items-center">
      <svg 
        className="w-5 h-5 text-red-600 mr-2" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
        />
      </svg>
      <div className="flex-1">
        <h4 className="text-sm font-medium text-red-800">
          Component Error
        </h4>
        <p className="text-sm text-red-700 mt-1">
          This component failed to render properly.
        </p>
      </div>
      <button
        onClick={resetErrorBoundary}
        className="ml-4 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
      >
        Retry
      </button>
    </div>
  </div>
)

// Hook for programmatic error handling
export const useErrorHandler = () => {
  const { showBoundary } = useErrorBoundary()
  
  return (error, errorInfo) => {
    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('Error caught by error handler:', error, errorInfo)
    }
    
    // Report error to error tracking service in production
    if (import.meta.env.PROD) {
      // TODO: Integrate with error tracking service (e.g., Sentry)
      // reportError(error, errorInfo)
    }
    
    // Show error boundary
    showBoundary(error)
  }
}

export default ErrorFallback