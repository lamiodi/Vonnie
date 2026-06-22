import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../contexts/AuthContext';
import Analytics from '../components/Analytics';
import AdminSettings from '../components/AdminSettings';
import SyncStatus from '../components/SyncStatus';
import { apiGet, apiPut, API_ENDPOINTS } from '../utils/api';
import { handleError } from '../utils/errorHandler';
import { createNigeriaISOString } from '../utils/formatters';
import toast, { Toaster } from 'react-hot-toast';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { cacheDashboardSnapshot, getCachedDashboardSnapshot } from '../services/offlineStore';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const { isOnline } = useNetworkStatus();
  const { syncStatus, pendingCount } = useOfflineSync();
  const [stats, setStats] = useState({
    todayBookings: 0,
    todayRevenue: 0,
    todayExpenses: 0,
    todayNetProfit: 0,
    lowStockItems: 0,
    activeCoupons: 0
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [unprocessedAlerts, setUnprocessedAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [animatingStats, setAnimatingStats] = useState([false, false, false, false]);
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
      // Show success toast
      const message = isEnabled ? 'Signups enabled successfully' : 'Signups disabled successfully';
      toast.success(message);
    } catch (error) {
      console.error('Error updating signup status:', error);
      toast.error('Failed to update signup status. Please try again.');
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
      // Show loading toast
      const loadingToast = toast.loading('Loading dashboard data...');
      
      const requests = [apiGet(API_ENDPOINTS.BOOKINGS)];
      
      // Only fetch inventory, coupons, and expenses data if user is admin or manager
      if (user?.role === 'admin' || user?.role === 'manager') {
        requests.push(apiGet(API_ENDPOINTS.REPORTS_INVENTORY));
        requests.push(apiGet(API_ENDPOINTS.REPORTS_COUPONS));
        requests.push(apiGet(API_ENDPOINTS.EXPENSES_TODAY));
      }
      
      const responses = await Promise.allSettled(requests);
      
      const bookingsResponse = responses[0].status === 'fulfilled' ? { data: responses[0].value } : { data: [] };
      const inventoryResponse = responses[1]?.status === 'fulfilled' ? { data: responses[1].value } : { data: { low_stock_items: 0 } };
      const couponsResponse = responses[2]?.status === 'fulfilled' ? { data: responses[2].value } : { data: { active_coupons: 0 } };
      const expensesResponse = responses[3]?.status === 'fulfilled' ? { data: responses[3].value } : { data: { total: 0, count: 0 } };

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
      const expensesData = expensesResponse.data;
      
      const todayExpenses = parseFloat(expensesData.total || 0);
      const todayNetProfit = todayRevenue - todayExpenses;

      const newStats = {
        todayBookings: todayBookings.length,
        todayRevenue,
        todayExpenses,
        todayNetProfit,
        lowStockItems: inventoryData.low_stock_items || inventoryData.lowStockItems || 0,
        activeCoupons: couponsData.active_coupons || couponsData.activeCoupons || 0
      };

      setStats(newStats);
      
      // Trigger animations for stats
      setAnimatingStats([true, true, true, true]);
      setTimeout(() => setAnimatingStats([false, false, false, false]), 1000);

      const unprocessedPast = bookingsResponse.data.filter(booking => {
        if (!booking.scheduled_time && !booking.created_at && !booking.booking_date) return false;
        const bookingDate = new Date(booking.scheduled_time || booking.created_at || booking.booking_date).toISOString().split('T')[0];
        const isPast = bookingDate < today;
        const isUnprocessed = ['scheduled', 'in-progress', 'pending_confirmation'].includes(booking.status);
        const hasWorker = booking.worker_id || (booking.workers && booking.workers.length > 0);
        return isPast && isUnprocessed && hasWorker;
      });
      setUnprocessedAlerts(unprocessedPast);

      setRecentBookings(bookingsResponse.data.slice(0, 5));
      
      // Success toast
      toast.success('Dashboard loaded successfully!', { id: loadingToast });
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to load dashboard data';
      toast.error(errorMsg);
      handleError(error, 'Failed to load dashboard data');
      // Set default values to prevent white screen
      setStats({
        todayBookings: 0,
        todayRevenue: 0,
        lowStockItems: 0,
        activeCoupons: 0
      });
      setUnprocessedAlerts([]);
      setRecentBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSignupStatusToggle = async (newStatus) => {
    try {
      setUpdatingSignupStatus(true);
      await updateSignupStatus(newStatus, '');
      
      // Refresh the signup status after update
      await fetchSignupStatus();
    } catch (error) {
      console.error('Error toggling signup status:', error);
      toast.error('Failed to update signup status. Please try again.');
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

  // Enhanced Loading Skeleton Component with shimmer effect
  const StatCardSkeleton = () => (
    <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse relative overflow-hidden">
      {/* Shimmer overlay */}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
      
      <div className="relative z-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl">
              <div className="w-8 h-8 bg-gray-400 rounded"></div>
            </div>
            <div className="ml-4">
              <div className="h-4 bg-gray-400 rounded w-32 mb-2"></div>
              <div className="h-8 bg-gray-400 rounded w-20"></div>
            </div>
          </div>
          <div className="text-gray-200">
            <div className="w-12 h-12 bg-gray-400 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  );

  // Enhanced Animated Stat Card Component
  const StatCard = ({ icon, title, value, change, color, index }) => {
    const [isHovered, setIsHovered] = useState(false);
    const isAnimating = animatingStats[index];
    
    return (
      <div 
        className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1 group relative overflow-hidden"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Animated gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-15 transition-opacity duration-500 ${color}`}></div>
        
        {/* Floating particles animation */}
        <div className="absolute inset-0 overflow-hidden">
          {isHovered && Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.3}s`
              }}
            />
          ))}
        </div>
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center">
            <div className={`p-3 bg-gradient-to-br rounded-xl group-hover:from-opacity-20 group-hover:to-opacity-40 transition-all duration-500 ${color} transform group-hover:scale-110`}>
              {icon}
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <div className="relative">
                <p className={`text-3xl font-bold text-gray-900 transition-all duration-700 ${isAnimating ? 'scale-110' : ''}`}>
                  {value}
                </p>
                {isAnimating && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg blur-md opacity-30 animate-pulse"></div>
                )}
              </div>
              <p className="text-xs text-green-600 mt-1 flex items-center transition-all duration-300 group-hover:font-medium">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {change}
              </p>
            </div>
          </div>
          <div className={`text-${color.replace('to-', '').replace('from-', '').replace('100', '200')} opacity-20 group-hover:opacity-40 transition-all duration-500 transform group-hover:scale-110`}>
            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
            </svg>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced user greeting with motivational messages
  const getUserGreeting = () => {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 6;
    
    const greetings = {
      morning: {
        default: 'Good morning',
        admin: 'Good morning, Captain',
        manager: 'Good morning, Manager',
        worker: 'Good morning, Team Member'
      },
      afternoon: {
        default: 'Good afternoon',
        admin: 'Good afternoon, Captain',
        manager: 'Good afternoon, Manager', 
        worker: 'Good afternoon, Team Member'
      },
      evening: {
        default: 'Good evening',
        admin: 'Good evening, Captain',
        manager: 'Good evening, Manager',
        worker: 'Good evening, Team Member'
      }
    };
    
    let timeOfDay;
    if (hour < 12) timeOfDay = 'morning';
    else if (hour < 17) timeOfDay = 'afternoon';
    else timeOfDay = 'evening';
    
    const role = user?.role || 'default';
    return greetings[timeOfDay][role] || greetings[timeOfDay].default;
  };

  // Get motivational message based on time and role
  const getMotivationalMessage = () => {
    const hour = new Date().getHours();
    const bookings = stats.todayBookings;
    const revenue = stats.todayRevenue;
    
    if (hour < 12) {
      if (bookings === 0) return "Let's make today productive! 🚀";
      if (bookings > 5) return "Excellent start to the day! ⭐";
      return "Great momentum building! 💪";
    } else if (hour < 17) {
      if (revenue > 50000) return "Amazing performance today! 💰";
      if (bookings > 0) return "Keeping the momentum going! 🔥";
      return "Perfect time to catch up on tasks! ⏰";
    } else {
      if (revenue > 30000) return "Outstanding day! Well done! 🎉";
      return "Great work today! Rest well! 🌙";
    }
  };

  // Enhanced personalized quick actions based on user role
  const getPersonalizedActions = () => {
    const baseActions = [
      { to: '/bookings', label: 'New Booking', icon: '📅', description: 'Schedule appointments', color: 'from-blue-500 to-blue-600' },
      { to: '/pos', label: 'POS Sale', icon: '🛒', description: 'Process transactions', color: 'from-green-500 to-green-600' },
    ];

    if (user?.role === 'admin' || user?.role === 'manager') {
      return [
        ...baseActions,
        { to: '/expenses', label: 'Expenses', icon: '💸', description: 'Track shop costs', color: 'from-red-500 to-red-600' },
        { to: '/inventory', label: 'Inventory', icon: '📦', description: 'Manage products', color: 'from-yellow-500 to-yellow-600' },
        { to: '/reports', label: 'Reports', icon: '📊', description: 'View analytics', color: 'from-purple-500 to-purple-600' },
        { to: '/fraud-review', label: 'Fraud Review', icon: '🛡️', description: 'Suspicious activity', color: 'from-orange-500 to-orange-600' },
      ];
    }

    return baseActions;
  };

  // Mobile optimized layout helper
  const isMobile = () => {
    return window.innerWidth < 768;
  };

  // Responsive grid columns based on screen size
  const getResponsiveGridCols = () => {
    if (isMobile()) return 'grid-cols-1';
    if (window.innerWidth < 1024) return 'grid-cols-2';
    return 'grid-cols-4';
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
      <div className="p-6">
        {/* Loading Toast */}
        <Toaster position="top-right" />
        
        {/* Welcome Header Skeleton */}
        <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100 animate-pulse">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-8 bg-gray-400 rounded w-64 mb-2"></div>
              <div className="h-4 bg-gray-400 rounded w-96"></div>
            </div>
            <div className="text-right">
              <div className="h-4 bg-gray-400 rounded w-32 mb-1"></div>
              <div className="h-3 bg-gray-400 rounded w-24"></div>
            </div>
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </section>

        {/* Quick Actions Skeleton */}
        <section className="mb-8">
          <div className="mb-4">
            <div className="h-6 bg-gray-400 rounded w-48"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl p-6 h-32 animate-pulse">
                <div className="h-8 bg-gray-400 rounded-full w-16 mb-3"></div>
                <div className="h-4 bg-gray-400 rounded w-20 mb-2"></div>
                <div className="h-3 bg-gray-400 rounded w-24"></div>
              </div>
            ))}
          </div>
        </section>
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
      <div className={`p-4 md:p-6 ${isMobile() ? 'touch-pan-y' : ''}`}>
        {/* Mobile Optimized Alerts Section */}
        {unprocessedAlerts.length > 0 && (user?.role === 'admin' || user?.role === 'manager') && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm touch-hover">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800">Action Required: Unprocessed Bookings</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>There are {unprocessedAlerts.length} booking(s) from previous days assigned to workers that are still marked as In-Progress or Scheduled. Please review them and mark as Completed or Cancelled.</p>
                </div>
                <div className="mt-3">
                  <Link 
                    to="/bookings" 
                    className="text-sm font-medium text-red-800 hover:text-red-900 underline inline-flex items-center"
                  >
                    Go to Bookings
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Offline Banner */}
        {!isOnline && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <span className="text-red-500 text-xl">⚠</span>
            <div>
              <div className="text-sm font-semibold text-red-800">You're offline</div>
              <div className="text-xs text-red-600">
                Dashboard showing cached data. {pendingCount > 0 ? `${pendingCount} item(s) pending sync.` : 'Changes will sync when reconnected.'}
              </div>
            </div>
          </div>
        )}

        {/* Sync Status Widget */}
        <div className="mb-6">
          <SyncStatus />
        </div>

        {/* Enhanced Welcome Header */}
        <header className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100 relative overflow-hidden">
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-10 right-10 w-20 h-20 bg-blue-200 rounded-full animate-pulse-slow"></div>
            <div className="absolute bottom-10 left-10 w-16 h-16 bg-indigo-200 rounded-full animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
            <div className="absolute top-1/3 left-1/4 w-12 h-12 bg-purple-200 rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
          </div>
          
          <div className="flex items-center justify-between relative z-10">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {getUserGreeting()}, {user?.name || 'User'}! 👋
              </h1>
              
              {/* Motivational message */}
              <p className="text-gray-600 mt-2 text-lg">
                {getMotivationalMessage()}
              </p>
              
              {/* Enhanced Today's Focus Section */}
              <div className="mt-4 p-4 bg-white/70 backdrop-blur-sm rounded-lg border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-blue-800 flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Today's Focus
                  </h3>
                  <div className="text-xs text-gray-500">Updated {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div className="space-y-2">
                  {unprocessedAlerts.length > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg border border-red-100">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-red-700 font-medium">Priority: Review {unprocessedAlerts.length} unprocessed booking(s)</span>
                    </div>
                  )}
                  {stats.lowStockItems > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg border border-yellow-100">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm text-yellow-700">Inventory: Restock {stats.lowStockItems} low item(s)</span>
                    </div>
                  )}
                  {stats.todayBookings === 0 && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-100">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-green-700">Opportunity: No bookings scheduled - consider marketing</span>
                    </div>
                  )}
                  {stats.todayBookings > 0 && stats.todayRevenue > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm text-blue-700">Performance: {stats.todayBookings} bookings • {formatCurrency(stats.todayRevenue)} revenue</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="text-right">
                <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-xs text-gray-400">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                <div className="mt-2">
                  <div className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                    System Online
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Optimized Quick Stats */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8" aria-label="Business statistics">
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
                  <p className="text-xs text-gray-500 mt-1">Appointments today</p>
                </div>
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
                  <p className="text-xs text-gray-500 mt-1">Booking revenue</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group" role="region" aria-labelledby="todays-expenses">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-gradient-to-br from-red-100 to-red-200 rounded-xl group-hover:from-red-200 group-hover:to-red-300 transition-all duration-300">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p id="todays-expenses" className="text-sm font-medium text-gray-600">Today's Expenses</p>
                  <p className="text-3xl font-bold text-gray-900" aria-describedby="todays-expenses">{formatCurrency(stats.todayExpenses)}</p>
                  <p className="text-xs text-gray-500 mt-1">Shop running costs</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group" role="region" aria-labelledby="todays-net-profit">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`p-3 bg-gradient-to-br rounded-xl group-hover:from-opacity-20 group-hover:to-opacity-40 transition-all duration-300 ${stats.todayNetProfit >= 0 ? 'from-emerald-100 to-emerald-200' : 'from-rose-100 to-rose-200'}`}>
                  <svg className={`w-8 h-8 ${stats.todayNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p id="todays-net-profit" className="text-sm font-medium text-gray-600">Today's Net Profit</p>
                  <p className={`text-3xl font-bold ${stats.todayNetProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} aria-describedby="todays-net-profit">{formatCurrency(stats.todayNetProfit)}</p>
                  <p className="text-xs text-gray-500 mt-1">Revenue minus expenses</p>
                </div>
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
            </div>
          </div>
        </section>

        {/* Signup Status Toggle (Admin Only) */}
        {user?.role === 'admin' && (
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

        {/* Admin Settings Panel (Admin Only) */}
        {user?.role === 'admin' && (
          <AdminSettings />
        )}

        {/* Mobile Optimized Quick Actions */}
        <section className="mb-8" aria-label="Quick actions">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
            <div className="text-sm text-gray-500">
              Most used features
            </div>
          </div>
          <div className={`grid ${getResponsiveGridCols()} gap-4`}>
            {getPersonalizedActions().map((action, index) => (
              <Link
                key={action.to}
                to={action.to}
                className="group relative overflow-hidden bg-gradient-to-br p-1 md:p-1 rounded-xl transition-all duration-500 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-lg hover:shadow-xl touch-hover"
                style={{ background: `linear-gradient(135deg, ${action.color}, ${action.color.replace('500', '600')})` }}
                aria-label={action.label}
              >
                {/* Animated background overlay */}
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                
                {/* Ripple effect container */}
                <div className="relative bg-white bg-opacity-95 rounded-xl p-4 md:p-6 text-center">
                  {/* Icon with glow effect */}
                  <div className="relative mb-4">
                    <div className="bg-white bg-opacity-20 rounded-full w-12 h-12 md:w-16 md:h-16 flex items-center justify-center mx-auto transition-all duration-500 group-hover:scale-110">
                      <span className="text-xl md:text-2xl">{action.icon}</span>
                    </div>
                    {/* Glow ring */}
                    <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20 animate-ping-slow"></div>
                  </div>
                  
                  <h3 className="font-semibold text-base md:text-lg mb-1 text-gray-900 group-hover:text-gray-800 transition-colors duration-300">
                    {action.label}
                  </h3>
                  <p className="text-gray-600 text-xs md:text-sm group-hover:text-gray-700 transition-colors duration-300">
                    {action.description}
                  </p>
                  
                  {/* Floating animation */}
                  <div className="mt-4 flex justify-center">
                    <svg className="w-4 h-4 md:w-5 md:h-5 text-gray-400 group-hover:text-gray-600 transition-all duration-300 transform group-hover:translate-y-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                  
                  {/* Mobile swipe indicator */}
                  {isMobile() && (
                    <div className="swipe-indicator">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                      </svg>
                    </div>
                  )}
                </div>
                
                {/* Hover particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-1 h-1 bg-white rounded-full animate-float-slow"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        animationDelay: `${i * 0.2}s`
                      }}
                    />
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Mobile Optimized Recent Bookings */}
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
            {isMobile() ? (
              // Mobile: Cards layout
              <div className="divide-y divide-gray-100">
                {recentBookings.length > 0 ? (
                  recentBookings.map((booking) => (
                    <div key={booking.id} className="p-4 hover:bg-gray-50 transition-all duration-200">
                      <div className="flex items-start justify-between mb-3">
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
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">{formatCurrency(booking.total_amount)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-gray-500 mb-1">Date & Time</div>
                          <div className="text-gray-900">{formatDate(booking.scheduled_time)}</div>
                          <div className="text-gray-500">{new Date(booking.scheduled_time).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>
                        </div>
                        <div>
                          <div className="text-gray-500 mb-1">Status</div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                            {booking.status}
                          </span>
                          <div className="text-gray-500 mt-1">Payment</div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(booking.payment_status)}`}>
                            {booking.payment_status || 'pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-500 text-sm font-medium">No recent bookings found</p>
                      <p className="text-gray-400 text-xs mt-1">Bookings will appear here once created</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Desktop: Table layout
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
            )}
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