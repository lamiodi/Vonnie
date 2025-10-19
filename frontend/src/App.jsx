import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'

// Auth Pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Settings from './pages/Settings'

// Guest Pages
import GuestBooking from './pages/customer/GuestBooking'

// Staff/Admin Pages
import Services from './pages/staff/Services'
import Inventory from './pages/staff/Inventory'
import Workers from './pages/staff/Workers'
import POS from './pages/staff/POS'
import Reports from './pages/staff/Reports'
import PaymentManagement from './pages/admin/PaymentManagement'

// Loading Component
import { LoadingSpinner } from './components/ui/LoadingSpinner'

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// Public Route Component (redirect if already authenticated)
const PublicRoute = ({ children }) => {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// Main App Component
const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <ResetPassword />
          </PublicRoute>
        }
      />
      <Route
        path="/book"
        element={<GuestBooking />}
      />

      {/* Protected Routes - All Users */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      {/* Staff/Admin Routes */}
      <Route
        path="/dashboard/services"
        element={
          <ProtectedRoute allowedRoles={['staff', 'admin']}>
            <Services />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/inventory"
        element={
          <ProtectedRoute allowedRoles={['staff', 'admin']}>
            <Inventory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/staff"
        element={
          <ProtectedRoute allowedRoles={['staff', 'admin']}>
            <Workers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/pos"
        element={
          <ProtectedRoute allowedRoles={['staff', 'admin']}>
            <POS />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/reports"
        element={
          <ProtectedRoute allowedRoles={['staff', 'admin']}>
            <Reports />
          </ProtectedRoute>
        }
      />

      {/* Admin Only Routes */}
      <Route
        path="/dashboard/payment-management"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <PaymentManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/settings"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Settings />
          </ProtectedRoute>
        }
      />

      {/* Default Route */}
      <Route path="/" element={<Navigate to="/book" replace />} />
      
      {/* 404 Route */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="text-6xl font-bold text-primary-600 mb-4">404</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
              <p className="text-gray-600 mb-6">The page you're looking for doesn't exist.</p>
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Go Back
              </button>
            </div>
          </div>
        }
      />
    </Routes>
  )
}

// Main App Component with Providers
function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <AppRoutes />
          
          {/* Global Toast Notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#fff',
                color: '#374151',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e5e7eb',
                borderRadius: '0.75rem',
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500'
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff'
                },
                style: {
                  borderLeft: '4px solid #10b981'
                }
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff'
                },
                style: {
                  borderLeft: '4px solid #ef4444'
                }
              },
              loading: {
                iconTheme: {
                  primary: '#f59e0b',
                  secondary: '#fff'
                },
                style: {
                  borderLeft: '4px solid #f59e0b'
                }
              }
            }}
          />
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App