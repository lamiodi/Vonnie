import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../ui/LoadingSpinner'

const ProtectedRoute = ({ 
  children, 
  requireAuth = true, 
  requiredRoles = [], 
  redirectTo = '/login',
  fallback = null 
}) => {
  const { 
    user, 
    profile, 
    loading, 
    initializing, 
    isAuthenticated, 
    hasAnyRole 
  } = useAuth()
  const location = useLocation()

  // Show loading spinner while initializing or loading
  if (initializing || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // If authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return (
      <Navigate 
        to={redirectTo} 
        state={{ from: location.pathname }} 
        replace 
      />
    )
  }

  // If authentication is not required but user is authenticated
  // (for login/register pages)
  if (!requireAuth && isAuthenticated) {
    const from = location.state?.from || getDashboardRoute(profile?.role)
    return <Navigate to={from} replace />
  }

  // If specific roles are required
  if (requireAuth && requiredRoles.length > 0) {
    // Wait for profile to load
    if (!profile) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
          <LoadingSpinner size="lg" />
        </div>
      )
    }

    // Check if user has required role
    if (!hasAnyRole(requiredRoles)) {
      return (
        fallback || (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
            <div className="max-w-md mx-auto text-center p-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Access Denied
              </h2>
              <p className="text-gray-600 mb-6">
                You don't have permission to access this page. 
                {requiredRoles.length === 1 
                  ? `This page requires ${requiredRoles[0]} access.`
                  : `This page requires one of the following roles: ${requiredRoles.join(', ')}.`
                }
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => window.history.back()}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Go Back
                </button>
                <Navigate 
                  to={getDashboardRoute(profile?.role)} 
                  className="block w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-center"
                >
                  Go to Dashboard
                </Navigate>
              </div>
            </div>
          </div>
        )
      )
    }
  }

  // Render children if all checks pass
  return children
}

// Helper function to get dashboard route based on user role
const getDashboardRoute = (role) => {
  switch (role) {
    case 'admin':
      return '/admin/dashboard'
    case 'staff':
      return '/staff/dashboard'
    case 'customer':
      return '/customer/dashboard'
    default:
      return '/dashboard'
  }
}

// Specific route components for different access levels
export const AdminRoute = ({ children, ...props }) => (
  <ProtectedRoute 
    requiredRoles={['admin']} 
    {...props}
  >
    {children}
  </ProtectedRoute>
)

export const StaffRoute = ({ children, ...props }) => (
  <ProtectedRoute 
    requiredRoles={['admin', 'staff']} 
    {...props}
  >
    {children}
  </ProtectedRoute>
)

export const CustomerRoute = ({ children, ...props }) => (
  <ProtectedRoute 
    requiredRoles={['customer']} 
    {...props}
  >
    {children}
  </ProtectedRoute>
)

export const PublicRoute = ({ children, ...props }) => (
  <ProtectedRoute 
    requireAuth={false} 
    {...props}
  >
    {children}
  </ProtectedRoute>
)

// Higher-order component for role-based rendering
export const withRoleAccess = (Component, requiredRoles = []) => {
  return function RoleAccessComponent(props) {
    const { hasAnyRole, profile } = useAuth()

    if (requiredRoles.length === 0 || hasAnyRole(requiredRoles)) {
      return <Component {...props} />
    }

    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center">
          <svg 
            className="w-5 h-5 text-yellow-600 mr-2" 
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
          <p className="text-yellow-800">
            This feature requires {requiredRoles.join(' or ')} access.
          </p>
        </div>
      </div>
    )
  }
}

// Hook for conditional rendering based on roles
export const useRoleAccess = (requiredRoles = []) => {
  const { hasAnyRole } = useAuth()
  return requiredRoles.length === 0 || hasAnyRole(requiredRoles)
}

export default ProtectedRoute