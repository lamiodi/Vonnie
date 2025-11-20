import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../contexts/AuthContext';
import Analytics from '../components/Analytics';
import { apiGet, apiPut, API_ENDPOINTS } from '../utils/api';
import { handleError } from '../utils/errorHandler';
import { createNigeriaISOString } from '../utils/formatters';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    todayBookings: 0,
    todayRevenue: 0,
    lowStockItems: 0,
    activeCoupons: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [signupStatus, setSignupStatus] = useState({
    is_enabled: true,
    message: 'Signups are currently enabled.',
    updated_at: createNigeriaISOString()
  });
  const [updatingSignupStatus, setUpdatingSignupStatus] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    if (user?.role === 'admin' || user?.role === 'manager') {
      fetchSignupStatus();
    }
  }, []);

  const fetchSignupStatus = async () => {
    try {
      const response = await apiGet(API_ENDPOINTS.ADMIN_SIGNUP_STATUS);
      setSignupStatus(response);
    } catch (error) {
      console.error('Error fetching signup status:', error);
      // Don't show error to user as this is an admin-only feature
    }
  };

  const updateSignupStatus = async (isEnabled, customMessage = null) => {
    try {
      setUpdatingSignupStatus(true);
      const response = await apiPut(API_ENDPOINTS.ADMIN_SIGNUP_STATUS, {
        is_enabled: isEnabled,
        message: customMessage
      });
      
      setSignupStatus(response.data || response);
      // Show success message
      const message = isEnabled ? 'Signups enabled successfully' : 'Signups disabled successfully';
      alert(message);
    } catch (error) {
      console.error('Error updating signup status:', error);
      alert('Failed to update signup status. Please try again.');
    } finally {
      setUpdatingSignupStatus(false);
    }
  };

  // Error boundary for component crashes
  if (hasError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold">Dashboard Error</h3>
          <p className="text-red-600">Something went wrong loading the dashboard. Please refresh the page.</p>
          <button 
            onClick={() => {
              setHasError(false);
              fetchDashboardData();
            }} 
            className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const fetchDashboardData = async () => {
    try {
      const requests = [apiGet(API_ENDPOINTS.BOOKINGS)];
      
      // Only fetch inventory and coupons data if user is admin or manager
      if (user?.role === 'admin' || user?.role === 'manager') {
        requests.push(apiGet(API_ENDPOINTS.REPORTS_INVENTORY));
        requests.push(apiGet(API_ENDPOINTS.REPORTS_COUPONS));
      }
      
      const responses = await Promise.allSettled(requests);
      
      const bookingsResponse = responses[0].status === 'fulfilled' ? { data: responses[0].value } : { data: [] };
      const inventoryResponse = responses[1]?.status === 'fulfilled' ? { data: responses[1].value } : { data: { low_stock_items: 0 } };
      const couponsResponse = responses[2]?.status === 'fulfilled' ? { data: responses[2].value } : { data: { active_coupons: 0 } };

      const today = new Date().toISOString().split('T')[0];
      const todayBookings = bookingsResponse.data.filter(booking => {
        const bookingDate = new Date(booking.scheduled_time || booking.created_at || booking.booking_date).toISOString().split('T')[0];
        return bookingDate === today;
      });

      const todayRevenue = todayBookings.reduce((sum, booking) => 
        sum + parseFloat(booking.service_price || booking.total_amount || 0), 0
      );

      // Handle different response structures from backend
      const inventoryData = inventoryResponse.data;
      const couponsData = couponsResponse.data;

      setStats({
        todayBookings: todayBookings.length,
        todayRevenue,
        lowStockItems: inventoryData.low_stock_items || inventoryData.lowStockItems || 0,
        activeCoupons: couponsData.active_coupons || couponsData.activeCoupons || 0
      });

      setRecentBookings(bookingsResponse.data.slice(0, 5));
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      handleError(error, 'Failed to load dashboard data');
      // Set default values to prevent white screen
      setStats({
        todayBookings: 0,
        todayRevenue: 0,
        lowStockItems: 0,
        activeCoupons: 0
      });
      setRecentBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupStatusToggle = async (newStatus) => {
    try {
      setUpdatingSignupStatus(true);
      const message = prompt('Enter a reason for this change (optional):');
      
      await updateSignupStatus(newStatus, message || '');
      
      // Refresh the signup status after update
      await fetchSignupStatus();
    } catch (error) {
      console.error('Error toggling signup status:', error);
      alert('Failed to update signup status. Please try again.');
    } finally {
      setUpdatingSignupStatus(false);
    }
  };

  const formatCurrency = (amount) => {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
    
    // Remove trailing .00 decimals
    return formatted.replace(/\.00$/, '');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled':
        return 'bg-green-100 text-green-800';
      case 'pending_confirmation':
        return 'bg-yellow-100 text-yellow-800';
      case 'in-progress':
        return 'bg-indigo-100 text-indigo-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (paymentStatus) => {
    switch (paymentStatus) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64" role="status" aria-label="Loading dashboard data">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state - prevent white screen
  if (!stats || !recentBookings) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <h3 className="text-red-800 font-semibold">Dashboard Error</h3>
          <p className="text-red-600">Unable to load dashboard data. Please refresh the page.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  try {
    return (
      <div className="p-6">
        {/* Welcome Header */}
        <header className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Welcome back, {user?.name || 'User'}! 👋
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                {user?.role === 'admin' 
                  ? "Here's what's happening with your business today."
                  : "Here's what's happening in your work area today."
                }
              </p>
            </div>
            <div className="hidden md:block">
              <div className="text-right">
                <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-xs text-gray-400">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Quick Stats */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" aria-label="Business statistics">
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group" role="region" aria-labelledby="todays-bookings">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl group-hover:from-blue-200 group-hover:to-blue-300 transition-all duration-300">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p id="todays-bookings" className="text-sm font-medium text-gray-600">Today's Bookings</p>
                  <p className="text-3xl font-bold text-gray-900" aria-describedby="todays-bookings">{stats.todayBookings}</p>
                  <p className="text-xs text-green-600 mt-1">+12% from yesterday</p>
                </div>
              </div>
              <div className="text-blue-100 group-hover:text-blue-200 transition-colors duration-300">
                <svg className="w-12 h-12 opacity-20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group" role="region" aria-labelledby="todays-revenue">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-green-100 to-green-200 rounded-xl group-hover:from-green-200 group-hover:to-green-300 transition-all duration-300">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p id="todays-revenue" className="text-sm font-medium text-gray-600">Today's Revenue</p>
                  <p className="text-3xl font-bold text-gray-900" aria-describedby="todays-revenue">{formatCurrency(stats.todayRevenue)}</p>
                  <p className="text-xs text-green-600 mt-1">+8% from yesterday</p>
                </div>
              </div>
              <div className="text-green-100 group-hover:text-green-200 transition-colors duration-300">
                <svg className="w-12 h-12 opacity-20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1.93.66 1.64 2.08 1.64 1.46 0 2.01-.91 2.01-1.65 0-.86-.5-1.37-2.22-1.87-2.01-.56-3.33-1.4-3.33-3.24 0-1.75 1.35-2.89 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.61-1.87-1.9-1.87-1.31 0-1.91.65-1.91 1.51 0 .82.6 1.27 2.39 1.72 2.06.52 3.16 1.35 3.16 3.24 0 1.85-1.26 2.98-3.13 3.31z"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group" role="region" aria-labelledby="low-stock-items">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-xl group-hover:from-yellow-200 group-hover:to-yellow-300 transition-all duration-300">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p id="low-stock-items" className="text-sm font-medium text-gray-600">Low Stock Items</p>
                  <p className="text-3xl font-bold text-gray-900" aria-describedby="low-stock-items">{stats.lowStockItems}</p>
                  <p className="text-xs text-red-600 mt-1">{stats.lowStockItems > 0 ? 'Needs attention' : 'All good'}</p>
                </div>
              </div>
              <div className="text-yellow-100 group-hover:text-yellow-200 transition-colors duration-300">
                <svg className="w-12 h-12 opacity-20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group" role="region" aria-labelledby="active-coupons">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl group-hover:from-purple-200 group-hover:to-purple-300 transition-all duration-300">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p id="active-coupons" className="text-sm font-medium text-gray-600">Active Coupons</p>
                  <p className="text-3xl font-bold text-gray-900" aria-describedby="active-coupons">{stats.activeCoupons}</p>
                  <p className="text-xs text-purple-600 mt-1">Active promotions</p>
                </div>
              </div>
              <div className="text-purple-100 group-hover:text-purple-200 transition-colors duration-300">
                <svg className="w-12 h-12 opacity-20" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.22-1.05-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/>
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* Signup Status Toggle (Admin/Manager Only) */}
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <section className="mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100" aria-label="Signup status management">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Signup Status</h2>
                <p className="text-gray-600 text-sm">
                  Control whether new users can register on the platform
                </p>
                {signupStatus && (
                  <p className="text-xs text-gray-500 mt-1">
                    Last updated: {new Date(signupStatus.updated_at).toLocaleString()} by {signupStatus.updated_by || 'system'}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">
                  {signupStatus?.is_enabled ? 'Signups Enabled' : 'Signups Disabled'}
                </span>
                <button
                  onClick={() => handleSignupStatusToggle(!signupStatus?.is_enabled)}
                  disabled={updatingSignupStatus}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                    signupStatus?.is_enabled ? 'bg-indigo-600' : 'bg-gray-200'
                  } ${updatingSignupStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
                  role="switch"
                  aria-checked={signupStatus?.is_enabled}
                  aria-label="Toggle signup status"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      signupStatus?.is_enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
            {signupStatus?.message && (
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-sm text-gray-700">
                  <strong>Status Message:</strong> {signupStatus.message}
                </p>
              </div>
            )}
          </section>
        )}

        {/* Quick Actions */}
        <section className="mb-8" aria-label="Quick actions">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
            <div className="text-sm text-gray-500">
              Most used features
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/bookings"
              className="group bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-6 rounded-xl text-center transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl"
              aria-label="Create new booking"
            >
              <div className="bg-white bg-opacity-20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 group-hover:bg-opacity-30 transition-all duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-1">New Booking</h3>
              <p className="text-blue-100 text-sm">Schedule appointments</p>
            </Link>

            <Link
              to="/pos"
              className="group bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-6 rounded-xl text-center transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-lg hover:shadow-xl"
              aria-label="Open point of sale system"
            >
              <div className="bg-white bg-opacity-20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 group-hover:bg-opacity-30 transition-all duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-1">POS Sale</h3>
              <p className="text-green-100 text-sm">Process transactions</p>
            </Link>

            <Link
              to="/inventory"
              className="group bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white p-6 rounded-xl text-center transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 shadow-lg hover:shadow-xl"
              aria-label="Manage inventory"
            >
              <div className="bg-white bg-opacity-20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 group-hover:bg-opacity-30 transition-all duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-1">Inventory</h3>
              <p className="text-yellow-100 text-sm">Manage products</p>
            </Link>

            <Link
              to="/reports"
              className="group bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white p-6 rounded-xl text-center transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 shadow-lg hover:shadow-xl"
              aria-label="View reports and analytics"
            >
              <div className="bg-white bg-opacity-20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 group-hover:bg-opacity-30 transition-all duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-lg mb-1">Reports</h3>
              <p className="text-purple-100 text-sm">View analytics</p>
            </Link>
          </div>
        </section>

        {/* Recent Bookings */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Recent Bookings</h2>
            <Link
              to="/bookings"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center transition-colors"
            >
              View all
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full" role="table" aria-label="Recent bookings table">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Customer
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Payment Status
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {recentBookings.length > 0 ? (
                    recentBookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50 transition-all duration-200">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="bg-blue-100 rounded-full w-10 h-10 flex items-center justify-center mr-3">
                              <span className="text-blue-600 font-semibold text-sm">
                                {booking.customer_name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{booking.customer_name}</div>
                              <div className="text-xs text-gray-500">ID: #{booking.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatDate(booking.scheduled_time)}</div>
                          <div className="text-xs text-gray-500">{new Date(booking.scheduled_time).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(booking.payment_status)}`}>
                            {booking.payment_status || 'pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">{formatCurrency(booking.total_amount)}</div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-gray-500 text-sm font-medium">No recent bookings found</p>
                          <p className="text-gray-400 text-xs mt-1">Bookings will appear here once created</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Quick Stats Summary */}
        <section className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200" role="region" aria-labelledby="quick-overview-title">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 id="quick-overview-title" className="text-lg font-semibold text-gray-900">Quick Overview</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                  <div className="text-3xl font-bold text-blue-600 mb-1">{stats.todayBookings}</div>
                  <div className="text-sm font-medium text-blue-700">Today's Bookings</div>
                  <div className="text-xs text-blue-600 mt-1">📅 Appointments</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                  <div className="text-3xl font-bold text-green-600 mb-1">{formatCurrency(stats.todayRevenue)}</div>
                  <div className="text-sm font-medium text-green-700">Today's Revenue</div>
                  <div className="text-xs text-green-600 mt-1">💰 Earnings</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
                  <div className="text-3xl font-bold text-yellow-600 mb-1">{stats.lowStockItems}</div>
                  <div className="text-sm font-medium text-yellow-700">Low Stock Items</div>
                  <div className="text-xs text-yellow-600 mt-1">⚠️ Alert</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                  <div className="text-3xl font-bold text-purple-600 mb-1">{stats.activeCoupons}</div>
                  <div className="text-sm font-medium text-purple-700">Active Coupons</div>
                  <div className="text-xs text-purple-600 mt-1">🎫 Promotions</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Analytics Section */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden" role="region" aria-labelledby="analytics-title">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 id="analytics-title" className="text-lg font-semibold text-gray-900">Analytics Overview</h3>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Last 30 days</span>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
          </div>
          <div className="p-6">
            <Analytics />
          </div>
        </section>
      </div>
    );
  } catch (error) {
    console.error('Dashboard rendering error:', error);
    setHasError(true);
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold">Dashboard Rendering Error</h3>
          <p className="text-red-600">Something went wrong displaying the dashboard. Please refresh the page.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
};

export default Dashboard;