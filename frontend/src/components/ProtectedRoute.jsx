import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requiredRole = null, requiredPermission = null }) => {
  const { user, loading, isAuthenticated, hasRole, hasPermission } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Checking authentication">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        <span className="sr-only">Verifying user authentication, please wait...</span>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="main">
        <div className="text-center" role="alert" aria-labelledby="access-denied-title">
          <h1 id="access-denied-title" className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4" aria-describedby="access-denied-title">
            You don't have the required role ({requiredRole}) to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="btn-primary"
            aria-label="Go back to previous page"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check permission requirement
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="main">
        <div className="text-center" role="alert" aria-labelledby="permission-denied-title">
          <h1 id="permission-denied-title" className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4" aria-describedby="permission-denied-title">
            You don't have the required permission ({requiredPermission}) to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="btn-primary"
            aria-label="Go back to previous page"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // User is authenticated and authorized
  return children;
};

export default ProtectedRoute;