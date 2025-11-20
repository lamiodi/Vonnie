import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Signup from './pages/Signup';
import PublicBooking from './pages/PublicBooking';
import WalkInBooking from './pages/WalkInBooking';
import BookingConfirmation from './pages/BookingConfirmation';
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import POSPage from './pages/POSPage';
import Reports from './pages/Reports';
import Coupons from './pages/Coupons';

import Inventory from './components/Inventory';
import Workers from './pages/Workers';
import Analytics from './components/Analytics';
import Attendance from './pages/Attendance';
import TransactionManagement from './components/TransactionManagement';

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <Routes>
          {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/public-booking" element={<PublicBooking />} />
        <Route path="/walk-in-booking" element={<WalkInBooking />} />
        <Route path="/booking-confirmation" element={<BookingConfirmation />} />
          
          {/* Protected Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="pos" element={<POSPage />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="workers" element={<Workers />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="reports" element={<Reports />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="transactions" element={<TransactionManagement />} />
          </Route>
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App;