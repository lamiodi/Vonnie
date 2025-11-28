import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookings } from '@/hooks/useBookings';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { apiGet, apiPost, apiPatch, apiDelete, API_ENDPOINTS, isAuthenticated } from '../utils/api';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { toast } from 'react-hot-toast';
import { 
  formatDate, 
  getStatusColor, 
  getStatusTooltip, 
  getPaymentStatusColor, 
  getPaymentStatusTooltip, 
  getQueueStatusColor,
  getCustomerTypeLabel,
  getCustomerTypeColor,
  normalizeCustomerType
} from '@/utils/bookingUtils';
import BookingForm from '../components/BookingForm';

// Queue priority utility functions (imported from bookingUtils)

const BookingStatusBadge = ({ status }) => {
  const map = {
    'pending_confirmation': { text: 'Pending Confirmation', classes: 'bg-yellow-100 text-yellow-800' },
    'scheduled': { text: 'Scheduled', classes: 'bg-blue-100 text-blue-800' },
    'in-progress': { text: 'In Progress', classes: 'bg-indigo-100 text-indigo-800' },
    'completed': { text: 'Completed', classes: 'bg-green-100 text-green-800' },
    'cancelled': { text: 'Cancelled', classes: 'bg-red-100 text-red-800' }
  };

  const { text, classes } = map[status] || { text: status || 'Unknown', classes: 'bg-gray-100 text-gray-800' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>{text}</span>;
};

const PaymentStatusBadge = ({ status }) => {
  const map = {
    'completed': { text: 'Paid', classes: 'bg-green-100 text-green-800' },
    'pending': { text: 'Pending', classes: 'bg-yellow-100 text-yellow-800' },
    'failed': { text: 'Failed', classes: 'bg-red-100 text-red-800' },
    'refunded': { text: 'Refunded', classes: 'bg-gray-100 text-gray-800' }
  };
  const { text, classes } = map[status] || { text: status || 'Unknown', classes: 'bg-gray-100 text-gray-800' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>{text}</span>;
};

// BookingsFilters Component
const BookingsFilters = ({
  searchTerm = '',
  onSearchChange = () => {},
  statusFilter = 'all',
  onStatusChange = () => {},
  customerTypeFilter = 'all',
  onCustomerTypeChange = () => {},
  dateFilter = 'all',
  onDateChange = () => {},
  onClearFilters = () => {}
}) => {
  const hasActiveFilters = searchTerm || statusFilter !== 'all' || customerTypeFilter !== 'all' || dateFilter !== 'all';
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Filters & Search</h3>
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear all filters
          </button>
        )}
      </div>
     
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search
          </label>
          <input
            type="text"
            placeholder="Search by customer, booking #, service..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Booking Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending_confirmation">Pending Confirmation</option>
            <option value="scheduled">Scheduled</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {/* Customer Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Customer Type
          </label>
          <select
            value={customerTypeFilter}
            onChange={(e) => onCustomerTypeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Customers</option>
            <option value="walk_in">Walk-in</option>
            <option value="pre_booked">Pre-booked</option>
          </select>
        </div>
        {/* Date Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Range
          </label>
          <select
            value={dateFilter}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="this-week">This Week</option>
            <option value="this-month">This Month</option>
          </select>
        </div>
      </div>
      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 flex flex-wrap gap-2">
          {searchTerm && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Search: "{searchTerm}"
              <button
                onClick={() => onSearchChange('')}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                ×
              </button>
            </span>
          )}
          {statusFilter !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Status: {statusFilter.replace('_', ' ')}
              <button
                onClick={() => onStatusChange('all')}
                className="ml-2 text-green-600 hover:text-green-800"
              >
                ×
              </button>
            </span>
          )}
          {customerTypeFilter !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Customer: {getCustomerTypeLabel(customerTypeFilter)}
              <button
                onClick={() => onCustomerTypeChange('all')}
                className="ml-2 text-purple-600 hover:text-purple-800"
              >
                ×
              </button>
            </span>
          )}
          {dateFilter !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              Date: {dateFilter.replace('-', ' ')}
              <button
                onClick={() => onDateChange('all')}
                className="ml-2 text-orange-600 hover:text-orange-800"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// BookingsHeader Component
const BookingsHeader = ({ todaysBookings = [], onNewBooking = () => {} }) => {
  const navigate = useNavigate();
  const categorizeTodaysBookings = (bookings) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const todaysBookings = bookings.filter(booking => {
      const bookingDate = new Date(booking.scheduled_time);
      return bookingDate >= startOfDay && bookingDate < endOfDay;
    });
    return {
      total: todaysBookings.length,
      scheduled: todaysBookings.filter(b => b.status === 'scheduled').length,
      inProgress: todaysBookings.filter(b => b.status === 'in-progress').length,
      completed: todaysBookings.filter(b => b.status === 'completed').length,
      cancelled: todaysBookings.filter(b => b.status === 'cancelled').length
    };
  };
  const stats = categorizeTodaysBookings(todaysBookings);
  return (
    <div className="mb-8">
      {/* Main Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bookings Management</h1>
          <p className="mt-2 text-gray-600">Manage your salon bookings and appointments</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/walk-in-booking')}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Walk-in Customer
          </button>
          <button
            onClick={onNewBooking}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Booking
          </button>
        </div>
      </div>
      {/* Today's Overview */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Today's Bookings Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600 mt-1">Total Bookings</div>
          </div>
          <div className="bg-blue-100 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-700">{stats.scheduled}</div>
            <div className="text-sm text-gray-600 mt-1">Scheduled</div>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-indigo-600">{stats.inProgress}</div>
            <div className="text-sm text-gray-600 mt-1">In Progress</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600 mt-1">Completed</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{stats.cancelled}</div>
            <div className="text-sm text-gray-600 mt-1">Cancelled</div>
          </div>
          {/* Rescheduled removed: not a valid booking status in schema */}
        </div>
      </div>
      {/* Status Legend */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Status Legend</h3>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mr-2"></span>
            <span>Scheduled</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-indigo-400 rounded-full mr-2"></span>
            <span>In Progress</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-green-400 rounded-full mr-2"></span>
            <span>Completed</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-red-400 rounded-full mr-2"></span>
            <span>Cancelled</span>
          </div>
        </div>
      </div>
      {/* Queue Priority Legend */}
      <div className="bg-green-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Queue Priority Legend</h3>
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mr-2"></span>
            <span>Walk-in (Priority 1)</span>
          </div>
          <div className="flex items-center">
            <span className="inline-block w-3 h-3 bg-yellow-400 rounded-full mr-2"></span>
            <span>Pre-booked (Priority 2)</span>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-2">All bookings processed through POS - products can be added during checkout</p>
      </div>
      {/* Manager Queue Dashboard */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Queue Management Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {todaysBookings.filter(b => b.payment_status !== 'completed' && b.status !== 'cancelled' && b.status !== 'completed').length}
                </div>
                <div className="text-sm text-red-700 font-medium">Awaiting Payment</div>
              </div>
              <div className="text-red-500 text-2xl">💳</div>
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {todaysBookings.filter(b => b.status === 'scheduled').length}
                </div>
                <div className="text-sm text-orange-700 font-medium">Ready for Service</div>
              </div>
              <div className="text-orange-500 text-2xl">⏰</div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {todaysBookings.filter(b => b.status === 'in-progress').length}
                </div>
                <div className="text-sm text-blue-700 font-medium">In Progress</div>
              </div>
              <div className="text-blue-500 text-2xl">✂️</div>
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <p>🔥 <strong>Priority Queue:</strong> Unpaid bookings appear first, sorted by queue priority and scheduled time</p>
        </div>
      </div>
    </div>
  );
};

// BookingsSummary Component
const BookingsSummary = ({ bookings = [] }) => {
  if (!bookings.length) {
    return null;
  }
  const totalBookings = bookings.length;
  const totalRevenue = bookings.reduce((sum, booking) => sum + parseFloat(booking.total_amount || 0), 0);
  const scheduledBookings = bookings.filter(b => b.status === 'scheduled').length;
  const pendingBookings = bookings.filter(b => b.status === 'pending_confirmation').length;
  const StatCard = ({ title, value, color = 'gray' }) => {
    const colorClasses = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      yellow: 'bg-yellow-50 text-yellow-600',
      red: 'bg-red-50 text-red-600',
      gray: 'bg-gray-50 text-gray-600'
    };
    return (
      <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
        <div className="text-sm font-medium text-gray-500">{title}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </div>
    );
  };
  return (
    <div className="mt-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Bookings Summary</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Bookings"
          value={totalBookings}
          color="blue"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          color="green"
        />
        <StatCard
          title="Scheduled"
          value={scheduledBookings}
          color="yellow"
        />
        <StatCard
          title="Pending Confirmation"
          value={pendingBookings}
          color="red"
        />
      </div>
    </div>
  );
};

// BookingsTable Component
const BookingsTable = ({
  bookings = [],
  loading = false,
  onStatusUpdate = () => {},
  onEdit = () => {},
  onDelete = () => {},
  onAssignWorker = () => {},
  onRemoveWorker = () => {},
  showQueueOrder = false,
  processingPayment = new Set(),
  setProcessingPayment = () => {}
}) => {
  const navigate = useNavigate();
  const [selectedBookings, setSelectedBookings] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedBookings(new Set());
    } else {
      setSelectedBookings(new Set(bookings.map(b => b.id)));
    }
    setSelectAll(!selectAll);
  };
  
  const handleSelectBooking = (bookingId) => {
    const newSelected = new Set(selectedBookings);
    if (newSelected.has(bookingId)) {
      newSelected.delete(bookingId);
    } else {
      newSelected.add(bookingId);
    }
    setSelectedBookings(newSelected);
    setSelectAll(newSelected.size === bookings.length);
  };
  
  const handleBulkStatusUpdate = (newStatus) => {
    selectedBookings.forEach(bookingId => {
      onStatusUpdate(bookingId, newStatus);
    });
    setSelectedBookings(new Set());
    setSelectAll(false);
  };
  
  const handleProcessPayment = async (booking) => {
    // Add booking to processing state for immediate UI feedback
    setProcessingPayment(prev => new Set(prev).add(booking.id));
    
    try {
      // For pre-booked customers with pending confirmation, approve first
      if (booking.status === 'pending_confirmation') {
        try {
          await approveBooking(booking.id);
        } catch (e) {
          console.error('Error approving booking:', e);
          // Continue even if approval fails - user can handle manually
        }
      }
      
      // Always check if worker assignment is needed before payment
      if (!booking.worker_id) {
        // Set flag to proceed to POS after assignment
        setProceedToPOSAfterAssignment(true);
        
        // Open worker assignment modal before payment processing
        setSelectedBookingForWorker(booking);
        setShowWorkerModal(true);
        
        // Remove from processing state since we're not going to POS yet
        setProcessingPayment(prev => {
          const newSet = new Set(prev);
          newSet.delete(booking.id);
          return newSet;
        });
        
        // Show notification about worker assignment needed
        toast.error('Please assign a worker before processing payment.');
        return;
      }
      
      // Navigate to POS page with booking details for payment processing
      navigate(`/pos?customer_id=${booking.customer_id}&booking_id=${booking.id}&booking_number=${booking.booking_number}`);
    } catch (error) {
      console.error('Error processing payment:', error);
      // Continue to POS even if there are errors - user can handle manually
      navigate(`/pos?customer_id=${booking.customer_id}&booking_id=${booking.id}&booking_number=${booking.booking_number}`);
    } finally {
      // Remove from processing state
      setProcessingPayment(prev => {
        const newSet = new Set(prev);
        newSet.delete(booking.id);
        return newSet;
      });
    }
  };
  
  const getCustomerDisplayData = (booking) => {
    if (booking.customer_name) {
      return {
        name: booking.customer_name,
        email: booking.customer_email,
        phone: booking.customer_phone
      };
    }
   
    if (booking.customer) {
      return {
        name: booking.customer.name || `${booking.customer.first_name || ''} ${booking.customer.last_name || ''}`.trim(),
        email: booking.customer.email,
        phone: booking.customer.phone
      };
    }
   
    return {
      name: 'Unknown Customer',
      email: 'N/A',
      phone: 'N/A'
    };
  };
  
  // Calculate queue position for today's bookings
  const getQueuePosition = (booking, allBookings) => {
    if (!showQueueOrder) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const bookingDate = new Date(booking.scheduled_time);
    if (bookingDate < today || bookingDate >= tomorrow) return null;
    
    // Get today's bookings that are not completed or cancelled
    const todaysBookings = allBookings.filter(b => {
      const bDate = new Date(b.scheduled_time);
      return bDate >= today && bDate < tomorrow &&
             b.status !== 'completed' && b.status !== 'cancelled';
    });
    
    // Sort by queue priority
    const sortedBookings = [...todaysBookings].sort((a, b) => {
      const paymentPriority = { 'completed': 0, 'pending': 1, 'failed': 2 };
      const aPayment = paymentPriority[a.payment_status] || 1;
      const bPayment = paymentPriority[b.payment_status] || 1;
     
      if (aPayment !== bPayment) return aPayment - bPayment;
      
      // Priority 2: Customer type (pre-booked first)
      const aType = normalizeCustomerType(a.customer_type);
      const bType = normalizeCustomerType(b.customer_type);
      const isAWalkIn = !a.customer_id || aType === 'walk_in';
      const isBWalkIn = !b.customer_id || bType === 'walk_in';
      if (isAWalkIn !== isBWalkIn) return isAWalkIn ? 1 : -1;
      
      // Priority 3: Scheduled time (earlier first)
      return new Date(a.scheduled_time) - new Date(b.scheduled_time);
    });
    
    const position = sortedBookings.findIndex(b => b.id === booking.id);
    return position >= 0 ? position + 1 : null;
  };
  
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading bookings...
        </div>
      </div>
    );
  }
  
  if (!bookings.length) {
    return (
      <div className="text-center py-12" role="status" aria-label="No bookings found">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No bookings found</h3>
        <p className="mt-1 text-sm text-gray-500">No bookings match your current filters.</p>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow rounded-lg">
      {/* Bulk Actions Toolbar */}
      {selectedBookings.size > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm text-gray-700">
                {selectedBookings.size} booking{selectedBookings.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handleBulkStatusUpdate('cancelled')}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel Selected
              </button>
              <button
                onClick={() => {
                  setSelectedBookings(new Set());
                  setSelectAll(false);
                }}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="w-full overflow-visible">
        <table className="w-full divide-y divide-gray-200 min-w-full table-auto">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th scope="col" className="w-12 px-2 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </th>
              <th scope="col" className="w-20 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Booking #
              </th>
              {showQueueOrder && (
                <th scope="col" className="w-16 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Queue #
              </th>
              )}
              <th scope="col" className="w-28 xl:w-32 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th scope="col" className="w-32 xl:w-36 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Service
              </th>
              <th scope="col" className="w-24 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scheduled Time
              </th>
              <th scope="col" className="w-24 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Worker
              </th>
              <th scope="col" className="w-20 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" className="w-24 xl:w-28 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="w-20 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment
              </th>
              <th scope="col" className="w-20 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th scope="col" className="w-40 xl:w-48 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bookings.map((booking) => {
              const customerData = getCustomerDisplayData(booking);
              const queuePosition = getQueuePosition(booking, bookings);
              const hasWorkers = booking.workers && booking.workers.length > 0;
              
              return (
                <tr key={booking.id} className="hover:bg-gray-50">
                  <td className="w-12 px-2 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedBookings.has(booking.id)}
                      onChange={() => handleSelectBooking(booking.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="w-20 px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{booking.booking_number}
                  </td>
                  {showQueueOrder && (
                    <td className="w-16 px-2 py-4 whitespace-nowrap">
                      {queuePosition ? (
                        <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold border-2 ${
                          queuePosition === 1 ? 'bg-green-100 text-green-800 border-green-300 shadow-lg' :
                          queuePosition <= 3 ? 'bg-blue-100 text-blue-800 border-blue-300' :
                          'bg-gray-100 text-gray-800 border-gray-300'
                        }`}>
                          #{queuePosition}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  )}
                  <td className="w-28 xl:w-32 px-3 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{customerData.name}</div>
                    <div className="text-sm text-gray-500">{customerData.phone}</div>
                  </td>
                  <td className="w-32 xl:w-36 px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {booking.service_names ? booking.service_names.join(', ') : booking.service_name || 'N/A'}
                  </td>
                  <td className="w-24 xl:w-28 px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDateTime(booking.scheduled_time)}
                  </td>
                  <td className="w-24 px-2 py-4 whitespace-nowrap">
                    {hasWorkers ? (
                      <div>
                        <div className="font-medium text-gray-900">
                          {booking.workers[0].worker_name}
                          {booking.workers.length > 1 && (
                            <span className="text-xs text-gray-500 ml-1">
                              +{booking.workers.length - 1} more
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {booking.workers.slice(0, 2).map(w => w.worker_name).join(', ')}
                          {booking.workers.length > 2 && '...'}
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-500">Not assigned</span>
                    )}
                  </td>
                  <td className="w-20 px-2 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCustomerTypeColor(normalizeCustomerType(booking.customer_type))}`}>
                      {getCustomerTypeLabel(normalizeCustomerType(booking.customer_type))}
                    </span>
                  </td>
                  <td className="w-24 px-2 py-4 whitespace-nowrap">
                    <BookingStatusBadge status={booking.status} />
                  </td>
                  <td className="w-20 px-2 py-4 whitespace-nowrap">
                    <PaymentStatusBadge status={booking.payment_status} />
                  </td>
                  <td className="w-20 px-2 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(booking.total_amount)}
                  </td>
                  <td className="w-40 xl:w-48 px-3 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-col gap-1">
                      {/* Primary Actions - Payment & Service Flow */}
                      <div className="flex flex-wrap gap-1">
                        {/* Process Payment - Primary Action */}
                        {booking.payment_status !== 'completed' && (
                          <button
                            onClick={() => handleProcessPayment(booking)}
                            disabled={processingPayment.has(booking.id)}
                            title={processingPayment.has(booking.id) ? 'Processing payment...' : 'Process payment'}
                            className={`inline-flex items-center px-2 py-1 text-xs font-semibold text-white rounded shadow-sm transition-colors ${
                              processingPayment.has(booking.id) 
                                ? 'bg-green-400 cursor-not-allowed' 
                                : 'bg-green-600 hover:bg-green-700'
                            }`}
                          >
                            {processingPayment.has(booking.id) ? (
                              <>
                                <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing
                              </>
                            ) : (
                              <>
                                💳 Pay
                              </>
                            )}
                          </button>
                        )}
                       
                        {/* Status Progression */}
                        {booking.status === 'scheduled' && (
                          <button
                            onClick={() => onStatusUpdate(booking.id, 'in-progress')}
                            title="Start service"
                            className="inline-flex items-center px-2 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm transition-colors"
                          >
                            Start
                          </button>
                        )}
                       
                        {booking.status === 'in-progress' && (
                          <button
                            onClick={() => onStatusUpdate(booking.id, 'completed')}
                            title="Complete service"
                            className="inline-flex items-center px-2 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition-colors"
                          >
                            Done
                          </button>
                        )}
                      </div>
                     
                      {/* Secondary Actions - Assignment & Management */}
                      <div className="flex flex-wrap gap-1">
                        {/* Worker Assignment */}
                        {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                          <>
                            <button
                              onClick={() => onAssignWorker(booking)}
                              title={hasWorkers ? 'Reassign worker' : 'Assign worker'}
                              className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-purple-700 hover:text-purple-900 border border-purple-300 rounded hover:bg-purple-50 transition-colors"
                            >
                              {hasWorkers ? '👷 Reassign' : '👷 Assign'}
                            </button>
                            
                            {/* Remove Worker option if workers are assigned */}
                            {hasWorkers && (
                              <button
                                onClick={() => onRemoveWorker(booking)}
                                title="Remove worker"
                                className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-red-700 hover:text-red-900 border border-red-300 rounded hover:bg-red-50 transition-colors"
                              >
                                ❌ Worker
                              </button>
                            )}
                          </>
                        )}
                       
                        {/* Cancellation */}
                        {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                          <button
                            onClick={() => onStatusUpdate(booking.id, 'cancelled')}
                            title="Cancel booking"
                            className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-red-700 hover:text-red-900 border border-red-300 rounded hover:bg-red-50 transition-colors"
                          >
                            🚫 Cancel
                          </button>
                        )}
                       
                        {/* Edit/Delete Actions */}
                        <button
                          onClick={() => onEdit(booking)}
                          title="Edit booking"
                          className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:text-blue-900 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => onDelete(booking.id)}
                          title="Delete booking"
                          className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-red-700 hover:text-red-900 border border-red-300 rounded hover:bg-red-50 transition-colors"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// WorkerAssignmentModal Component
const WorkerAssignmentModal = ({ booking, onClose, onSuccess }) => {
  const [workers, setWorkers] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [currentWorkers, setCurrentWorkers] = useState([]);
  const [busyWorkers, setBusyWorkers] = useState([]);
  const [workerConflicts, setWorkerConflicts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!booking) return;
      
      setDataLoading(true);
      setError('');
      
      try {
        // Fetch workers sequentially to prevent race conditions
        console.log('Fetching workers...');
        const workersData = await apiGet(API_ENDPOINTS.WORKERS);
        console.log('Workers data response:', workersData);
        const availableWorkers = Array.isArray(workersData) ? workersData : (workersData.data || []);
        console.log('Available workers:', availableWorkers);
        setWorkers(availableWorkers);
        
        // Fetch current workers for this booking
        console.log('Fetching current workers for booking:', booking.id);
        const currentWorkersData = await apiGet(API_ENDPOINTS.BOOKING_WORKERS(booking.id));
        console.log('Current workers data response:', currentWorkersData);
        const currentWorkerList = Array.isArray(currentWorkersData) ? currentWorkersData : (currentWorkersData.data || []);
        console.log('Current worker list:', currentWorkerList);
        setCurrentWorkers(currentWorkerList);
        
        // Set selected workers after both fetches complete
        const currentWorkerIds = currentWorkerList.map(w => w.worker_id);
        console.log('Current worker IDs:', currentWorkerIds);
        setSelectedWorkers(currentWorkerIds);
        
        // Fetch busy workers for the booking date to show availability status
        const bookingDate = new Date(booking.scheduled_time).toISOString().split('T')[0];
        console.log('Fetching busy workers for date:', bookingDate);
        const busyWorkersData = await apiGet(`/api/public/workers/busy-today?date=${bookingDate}`);
        console.log('Busy workers data response:', busyWorkersData);
        const busyWorkerList = Array.isArray(busyWorkersData) ? busyWorkersData : (busyWorkersData.data || []);
        console.log('Busy worker list:', busyWorkerList);
        setBusyWorkers(busyWorkerList);
        
      } catch (error) {
        console.error('Error fetching worker data:', error);
        setError('Failed to fetch workers. Please try again.');
        
        // Set empty states on error
        setWorkers([]);
        setCurrentWorkers([]);
        setSelectedWorkers([]);
        setBusyWorkers([]);
      } finally {
        setDataLoading(false);
      }
    };
    
    fetchData();
  }, [booking]);

  // Check conflicts for current workers when modal opens
  useEffect(() => {
    if (booking && currentWorkers.length > 0) {
      const currentWorkerIds = currentWorkers.map(w => w.worker_id);
      console.log('Checking conflicts for current workers:', currentWorkerIds);
      checkWorkerConflicts(currentWorkerIds);
    }
  }, [booking, currentWorkers]);

  const checkWorkerConflicts = async (workerIds) => {
    if (!booking || workerIds.length === 0) return;
    
    try {
      const bookingStart = new Date(booking.scheduled_time);
      const bookingEnd = new Date(bookingStart.getTime() + (booking.duration || 60) * 60 * 1000);
      
      console.log('Checking conflicts for workers:', workerIds);
      console.log('Booking time range:', bookingStart.toISOString(), 'to', bookingEnd.toISOString());
      console.log('Current booking ID:', booking.id);
      
      // **VALIDATION**: Check if booking time is valid
      if (isNaN(bookingStart.getTime()) || isNaN(bookingEnd.getTime())) {
        console.error('Invalid booking time detected');
        setWorkerConflicts([{
          worker_id: 'invalid_time',
          message: 'Invalid booking time detected',
          type: 'validation_error'
        }]);
        return;
      }
      
      // **VALIDATION**: Check if booking is in the past
      const now = new Date();
      if (bookingEnd < now) {
        console.error('Cannot assign workers to past booking');
        setWorkerConflicts([{
          worker_id: 'past_booking',
          message: 'Cannot assign workers to bookings in the past',
          type: 'validation_error'
        }]);
        return;
      }
      
      // Check for conflicts with selected workers
      const conflictUrl = `/api/bookings/conflicts?workerIds=${workerIds.join(',')}&startTime=${bookingStart.toISOString()}&endTime=${bookingEnd.toISOString()}&excludeBookingId=${booking.id}`;
      console.log('Making conflict check request to:', conflictUrl);
      
      const response = await apiGet(conflictUrl);
      
      console.log('Conflict check response:', response);
      console.log('Response type:', typeof response);
      console.log('Response keys:', response ? Object.keys(response) : 'No response');
      console.log('Response.data:', response?.data);
      console.log('Response.conflicts:', response?.conflicts);
      
      // Handle different response formats
      let conflicts = [];
      if (response) {
        if (response.conflicts) {
          conflicts = response.conflicts;
        } else if (response.data && response.data.conflicts) {
          conflicts = response.data.conflicts;
        } else if (Array.isArray(response)) {
          conflicts = response;
        }
      }
      
      // **ADDITIONAL VALIDATION**: Check worker availability status
      const unavailableWorkers = workerIds.filter(workerId => {
        const worker = workers.find(w => w.id === workerId);
        return worker && (worker.status === 'unavailable' || worker.status === 'on_leave');
      });
      
      if (unavailableWorkers.length > 0) {
        conflicts.push(...unavailableWorkers.map(workerId => ({
          worker_id: workerId,
          message: 'Worker is currently unavailable',
          type: 'availability'
        })));
      }
      
      // **ADDITIONAL VALIDATION**: Check if workers have required skills for the service
      if (booking.service_id) {
        const unqualifiedWorkers = workerIds.filter(workerId => {
          const worker = workers.find(w => w.id === workerId);
          return worker && worker.specialties && !worker.specialties.includes(booking.service_name);
        });
        
        if (unqualifiedWorkers.length > 0) {
          conflicts.push(...unqualifiedWorkers.map(workerId => ({
            worker_id: workerId,
            message: 'Worker does not have required specialty for this service',
            type: 'qualification'
          })));
        }
      }
      
      console.log('Processed conflicts:', conflicts);
      setWorkerConflicts(conflicts);
    } catch (error) {
      console.error('Error checking worker conflicts:', error);
      setWorkerConflicts([{
        worker_id: 'system_error',
        message: 'Unable to check worker availability. Please try again.',
        type: 'system_error'
      }]);
    }
  };

  // Test function to verify conflict API is working
  const testConflictAPI = async () => {
    console.log('=== TESTING CONFLICT API ===');
    try {
      // Test the test endpoint first
      const testResponse = await apiGet('/api/bookings/conflicts/test');
      console.log('Test endpoint response:', testResponse);
      
      // Test with sample data
      const sampleWorkerIds = [1, 2, 3];
      const sampleStartTime = new Date().toISOString();
      const sampleEndTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour later
      
      console.log('Testing with sample data:', {
        workerIds: sampleWorkerIds,
        startTime: sampleStartTime,
        endTime: sampleEndTime
      });
      
      const conflictUrl = `/api/bookings/conflicts?workerIds=${sampleWorkerIds.join(',')}&startTime=${sampleStartTime}&endTime=${sampleEndTime}`;
      console.log('Making conflict check request to:', conflictUrl);
      
      const response = await apiGet(conflictUrl);
      console.log('Conflict API response:', response);
      
    } catch (error) {
      console.error('=== CONFLICT API TEST ERROR ===');
      console.error('Error message:', error.message);
      console.error('Error response:', error.response);
      console.error('Full error:', error);
    }
  };

  const handleWorkerChange = (workerId) => {
    setSelectedWorkers(prev => {
      let newSelection;
      
      if (prev.includes(workerId)) {
        // Removing worker - always allowed
        newSelection = prev.filter(id => id !== workerId);
      } else {
        // Adding worker - validate first
        const worker = workers.find(w => w.id === workerId);
        
        if (worker) {
          // **VALIDATION**: Check if worker is inactive
          if (worker.status === 'inactive' || worker.status === 'suspended') {
            setError(`Cannot select ${worker.name}: Worker is ${worker.status}`);
            return prev; // Don't add the worker
          }
          
          // **VALIDATION**: Check if worker is marked as busy
          const isBusy = busyWorkers.some(busy => 
            (busy.worker_id === workerId || busy.id === workerId)
          );
          if (isBusy) {
            setError(`Cannot select ${worker.name}: Worker is currently busy`);
            return prev; // Don't add the worker
          }
          
          // **VALIDATION**: Check if worker has required specialty
          if (booking.service_name && worker.specialties && worker.specialties.length > 0) {
            const hasRequiredSpecialty = worker.specialties.includes(booking.service_name);
            if (!hasRequiredSpecialty) {
              setError(`Cannot select ${worker.name}: Worker does not have required specialty for ${booking.service_name}`);
              return prev; // Don't add the worker
            }
          }
        }
        
        newSelection = [...prev, workerId];
      }
      
      // Check conflicts for the new selection
      if (newSelection.length > 0) {
        checkWorkerConflicts(newSelection);
      } else {
        setWorkerConflicts([]);
      }
      
      // Clear any selection errors when selection changes
      if (error) {
        setError('');
      }
      
      return newSelection;
    });
  };

  const handleAssignWorkers = async () => {
    if (selectedWorkers.length === 0) {
      setError('Please select at least one worker');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // **PRE-VALIDATION STEP**: Check for conflicts before attempting assignment
      console.log('Starting pre-validation for worker assignment...');
      
      // Check conflicts for selected workers
      await checkWorkerConflicts(selectedWorkers);
      
      // Wait a moment for state to update, then check if there are conflicts
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // **CONFLICT DETECTION**: Prevent assignment if conflicts exist
      if (workerConflicts.length > 0) {
        const conflictedWorkerNames = workerConflicts
          .map(conflict => workers.find(w => w.id === conflict.worker_id)?.name || `Worker ${conflict.worker_id}`)
          .filter(name => name)
          .join(', ');
        
        setError(`Cannot assign workers due to scheduling conflicts: ${conflictedWorkerNames}. Please select different workers or adjust the booking time.`);
        setLoading(false);
        return;
      }
      
      // **AVAILABILITY CHECK**: Verify selected workers are not busy
      const busySelectedWorkers = selectedWorkers.filter(workerId => 
        busyWorkers.some(busy => busy.worker_id === workerId || busy.id === workerId)
      );
      
      if (busySelectedWorkers.length > 0) {
        const busyWorkerNames = busySelectedWorkers
          .map(workerId => workers.find(w => w.id === workerId)?.name || `Worker ${workerId}`)
          .filter(name => name)
          .join(', ');
        
        setError(`The following workers are marked as busy: ${busyWorkerNames}. Please select available workers.`);
        setLoading(false);
        return;
      }
      
      // **DUPLICATE CHECK**: Prevent assigning the same worker multiple times
      const uniqueWorkers = [...new Set(selectedWorkers)];
      if (uniqueWorkers.length !== selectedWorkers.length) {
        setError('Cannot assign the same worker multiple times. Please review your selection.');
        setLoading(false);
        return;
      }
      
      // **WORKER STATUS VALIDATION**: Ensure selected workers are active
      const inactiveWorkers = selectedWorkers.filter(workerId => {
        const worker = workers.find(w => w.id === workerId);
        return worker && (worker.status === 'inactive' || worker.status === 'suspended');
      });
      
      if (inactiveWorkers.length > 0) {
        const inactiveWorkerNames = inactiveWorkers
          .map(workerId => workers.find(w => w.id === workerId)?.name || `Worker ${workerId}`)
          .filter(name => name)
          .join(', ');
        
        setError(`Cannot assign inactive workers: ${inactiveWorkerNames}. Please select active workers.`);
        setLoading(false);
        return;
      }
      
      console.log('Pre-validation passed. Proceeding with worker assignment...');
      
      // Create consistent worker assignment payload
      const assignmentWorkers = selectedWorkers.map(workerId => {
        const found = workers.find(w => w.id === workerId);
        return {
          worker_id: workerId,
          role: 'primary',
          assigned_at: new Date().toISOString(),
          worker_name: found?.name || `Worker ${workerId}`
        };
      });
      
      // Retry mechanism for failed assignments with non-retryable error handling
      const assignWithRetry = async (maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`Assignment attempt ${attempt} of ${maxRetries}`);
            const result = await apiPost(API_ENDPOINTS.BOOKING_ASSIGN_WORKERS(booking.id), {
              workers: assignmentWorkers
            });
            console.log('Assignment successful:', result);
            return result;
          } catch (error) {
            console.error(`Assignment attempt ${attempt} failed:`, error);
            
            // Check for non-retryable errors - these should not be retried
            const statusCode = error.response?.status;
            const errorCode = error.response?.data?.error?.code;
            
            // Non-retryable errors: 400 (validation), 403 (permission), 404 (not found), 409 (conflict)
            const nonRetryableStatusCodes = [400, 403, 404, 409];
            const isNonRetryable = nonRetryableStatusCodes.includes(statusCode);
            
            if (isNonRetryable) {
              console.log(`Non-retryable error ${statusCode} detected, stopping retries`);
              throw error; // Don't retry non-retryable errors
            }
            
            // Check for specific non-retryable error codes
            const nonRetryableErrorCodes = [
              'MISSING_WORKERS',
              'WORKER_ALREADY_ASSIGNED_ERROR',
              'WORKER_AVAILABILITY_ERROR'
            ];
            
            if (errorCode && nonRetryableErrorCodes.includes(errorCode)) {
              console.log(`Non-retryable error code ${errorCode} detected, stopping retries`);
              throw error; // Don't retry specific business logic errors
            }
            
            // If this is the last attempt, throw the error
            if (attempt === maxRetries) throw error;
            
            // Exponential backoff: 1s, 2s, 4s (only for retryable errors)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
        }
      };
      
      await assignWithRetry();
      
      // Success callback and close modal
      onSuccess();
      onClose();
      
    } catch (error) {
      console.error('Error assigning workers after retries:', error);
      
      // Enhanced error handling with specific messages
      let errorMessage = 'Failed to assign workers. Please try again.';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
        // Check for specific worker conflict messages
        if (error.response.data.details && Array.isArray(error.response.data.details)) {
          const workerConflicts = error.response.data.details.filter(d => d.worker);
          if (workerConflicts.length > 0) {
            errorMessage = `Worker${workerConflicts.length > 1 ? 's' : ''} busy: ${workerConflicts.map(c => c.worker).join(', ')}`;
          }
        }
      } else if (error.message?.includes('Network')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to assign workers.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Booking not found. Please refresh and try again.';
      } else if (error.response?.status === 409) {
        errorMessage = 'One or more workers are already assigned to another booking at this time.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (!booking) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Assign Workers to Booking
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={testConflictAPI}
              className="px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
              title="Test Conflict API"
            >
              Test API
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close worker assignment"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Booking Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-800 mb-2">Booking Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Booking Number:</span>
              <span className="ml-2 font-medium">{booking.booking_number}</span>
            </div>
            <div>
              <span className="text-gray-600">Customer:</span>
              <span className="ml-2 font-medium">{booking.customer_name}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">Services:</span>
              <span className="ml-2 font-medium">{booking.service_names?.join(', ') || booking.service_name}</span>
            </div>
          </div>
        </div>
        
        {/* Current Workers */}
        {currentWorkers.length > 0 && (
          <div className="mb-6">
            <h3 className="font-medium text-gray-800 mb-2">Currently Assigned Workers</h3>
            <div className="flex flex-wrap gap-2">
              {currentWorkers.map(worker => (
                <span key={worker.id} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {worker.worker_name}
                  <button
                    onClick={() => handleWorkerChange(worker.worker_id)}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Worker Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Workers ({selectedWorkers.length} selected)
          </label>
          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
            {workers.map(worker => {
              const isSelected = selectedWorkers.includes(worker.id);
              const isCurrentlyAssigned = currentWorkers.some(w => w.worker_id === worker.id);
              const isBusy = busyWorkers.some(bw => bw.worker_id === worker.id);
              const hasConflict = workerConflicts.some(conflict => conflict.worker_id === worker.id);
              const conflictDetails = workerConflicts.find(conflict => conflict.worker_id === worker.id);
              
              console.log(`Worker ${worker.name} (ID: ${worker.id}): isSelected=${isSelected}, isCurrentlyAssigned=${isCurrentlyAssigned}, isBusy=${isBusy}, hasConflict=${hasConflict}`);
              console.log(`Busy workers:`, busyWorkers);
              console.log(`Worker conflicts:`, workerConflicts);
              
              return (
                <div
                  key={worker.id}
                  onClick={() => !isBusy && !hasConflict && handleWorkerChange(worker.id)}
                  className={`p-3 rounded-md border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : isCurrentlyAssigned
                      ? 'border-gray-300 bg-gray-50'
                      : isBusy
                      ? 'border-orange-200 bg-orange-50 opacity-60'
                      : hasConflict
                      ? 'border-red-200 bg-red-50 opacity-60'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } ${(isBusy || hasConflict) ? 'cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`font-medium ${
                        isBusy || hasConflict ? 'text-gray-500' : 'text-gray-900'
                      }`}>{worker.name}</div>
                      <div className="text-sm text-gray-600">{worker.role}</div>
                      {worker.specialty && (
                        <div className="text-xs text-purple-600 font-medium mt-1">
                          ⭐ {worker.specialty}
                        </div>
                      )}
                      {hasConflict && conflictDetails && (
                        <div className="text-xs text-red-600 mt-1">
                          Conflict: Booking {conflictDetails.booking_number} ({new Date(conflictDetails.scheduled_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {isSelected && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                          Selected
                        </span>
                      )}
                      {isCurrentlyAssigned && !isSelected && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 mr-2">
                          Currently Assigned
                        </span>
                      )}
                      {isBusy && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 mr-2">
                          Busy Today
                        </span>
                      )}
                      {hasConflict && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Booking Conflict
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md font-medium transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleAssignWorkers}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
            disabled={loading || selectedWorkers.length === 0}
          >
            {loading ? 'Assigning...' : `Assign ${selectedWorkers.length} Worker${selectedWorkers.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// WorkerRemovalModal Component
const WorkerRemovalModal = ({ booking, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedWorker, setSelectedWorker] = useState(null);

  const handleRemoveWorker = async () => {
    if (!selectedWorker) {
      setError('Please select a worker to remove');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      await apiDelete(API_ENDPOINTS.BOOKING_REMOVE_WORKER(booking.id, selectedWorker));
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error removing worker:', error);
      setError(error.response?.data?.error || 'Failed to remove worker');
    } finally {
      setLoading(false);
    }
  };

  if (!booking || !booking.workers || booking.workers.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Remove Worker</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close worker removal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-2">Booking: #{booking.booking_number}</h3>
          <p className="text-sm text-gray-600">Customer: {booking.customer_name}</p>
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Worker to Remove</label>
          <div className="space-y-2">
            {booking.workers.map(worker => (
              <div
                key={worker.id}
                onClick={() => setSelectedWorker(worker.worker_id)}
                className={`p-3 rounded-md border cursor-pointer ${
                  selectedWorker === worker.worker_id
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{worker.worker_name}</div>
                <div className="text-sm text-gray-600">{worker.role}</div>
              </div>
            ))}
          </div>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleRemoveWorker}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
            disabled={loading || !selectedWorker}
          >
            {loading ? 'Removing...' : 'Remove Worker'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Main Bookings Component
const Bookings = () => {
  const navigate = useNavigate();
  const { user, hasRole, isManager } = useAuth();
  const { bookings, loading, error, createBooking, updateBooking, deleteBooking, approveBooking, refetch: fetchBookings } = useBookings();

  // State for services, customers, and workers
  const [services, setServices] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [hasError, setHasError] = useState(false);
  
  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [showWorkerRemovalModal, setShowWorkerRemovalModal] = useState(false);
  const [selectedBookingForWorker, setSelectedBookingForWorker] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(new Set());
  const [proceedToPOSAfterAssignment, setProceedToPOSAfterAssignment] = useState(false);
  
  // Fetch bookings on component mount
  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
   
    const fetchData = async () => {
      try {
        // Fetch bookings first (most important)
        await fetchBookings();
       
        // Then fetch services and workers with a small delay to avoid overwhelming the server
        setTimeout(() => {
          fetchServices();
        }, 100);
       
        setTimeout(() => {
          fetchWorkers();
        }, 200);
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };
   
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Filter bookings based on search and filters
  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    const filtered = bookings.filter(booking => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const customerData = booking.customer_name ||
          (booking.customer ? `${booking.customer?.first_name || ''} ${booking.customer?.last_name || ''}`.trim() : '') ||
          'Unknown Customer';
       
        const matchesSearch =
          customerData.toLowerCase().includes(searchLower) ||
          (booking.customer_email && booking.customer_email.toLowerCase().includes(searchLower)) ||
          (booking.customer_phone && booking.customer_phone.toLowerCase().includes(searchLower)) ||
          ((booking.booking_number || '').toLowerCase().includes(searchLower)) ||
          (booking.service_name && booking.service_name.toLowerCase().includes(searchLower));
       
        if (!matchesSearch) return false;
      }
      // Status filter
      if (statusFilter !== 'all' && booking.status !== statusFilter) {
        return false;
      }
      // Customer type filter - use normalized underscore values
      if (customerTypeFilter !== 'all') {
        const type = normalizeCustomerType(booking.customer_type);
        const isWalkIn = type === 'walk_in' || !booking.customer_id;
        if (customerTypeFilter === 'walk_in' && !isWalkIn) return false;
        if (customerTypeFilter === 'pre_booked' && isWalkIn) return false;
      }
      // Date filter
      if (dateFilter !== 'all') {
        const bookingDate = new Date(booking.scheduled_time);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        switch (dateFilter) {
          case 'today':
            if (bookingDate < today || bookingDate >= tomorrow) return false;
            break;
          case 'tomorrow':
            if (bookingDate < tomorrow || bookingDate >= nextWeek) return false;
            break;
          case 'this-week':
            if (bookingDate < today || bookingDate >= nextWeek) return false;
            break;
          case 'this-month':
            if (bookingDate < today || bookingDate >= nextMonth) return false;
            break;
          default:
            break;
        }
      }
      return true;
    });
    // Sort bookings - prioritize today's bookings first, then by payment status and queue priority
    return filtered.sort((a, b) => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      
      const aDate = new Date(a.scheduled_time);
      const bDate = new Date(b.scheduled_time);
      
      // Priority 1: Today's bookings first
      const aIsToday = aDate >= startOfDay && aDate < endOfDay;
      const bIsToday = bDate >= startOfDay && bDate < endOfDay;
      
      if (aIsToday && !bIsToday) return -1;
      if (!aIsToday && bIsToday) return 1;
      
      // Priority 2: Payment status (unpaid first)
      if (a.payment_status !== 'completed' && b.payment_status === 'completed') return -1;
      if (a.payment_status === 'completed' && b.payment_status !== 'completed') return 1;
     
      // Priority 3: Queue priority (1 = highest, 3 = lowest)
      if (a.queue_priority !== b.queue_priority) {
        return a.queue_priority - b.queue_priority;
      }
     
      // Priority 4: Scheduled time - earlier bookings first
      return new Date(a.scheduled_time) - new Date(b.scheduled_time);
    });
  }, [bookings, searchTerm, statusFilter, customerTypeFilter, dateFilter]);
  
  // Get today's bookings for header
  const todaysBookings = useMemo(() => {
    if (!bookings) return [];
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return bookings.filter(booking => {
      const bookingDate = new Date(booking.scheduled_time);
      return bookingDate >= startOfDay && bookingDate < endOfDay;
    });
  }, [bookings]);
  
  // Fetch functions
  const fetchServices = async () => {
    try {
      const data = await apiGet(API_ENDPOINTS.SERVICES);
      setServices(data);
    } catch (error) {
      try {
        // Fallback to public endpoint if authenticated endpoint fails
        const fallback = await apiGet(API_ENDPOINTS.PUBLIC_SERVICES);
        setServices(Array.isArray(fallback) ? fallback : (fallback.data || []));
      } catch (fallbackError) {
        console.error('Error fetching services:', fallbackError);
        setServices([]);
      }
    }
  };
  
  const fetchWorkers = async () => {
    try {
      const data = await apiGet(API_ENDPOINTS.WORKERS);
      setWorkers(Array.isArray(data) ? data : []);
    } catch (error) {
      try {
        const fallback = await apiGet(API_ENDPOINTS.PUBLIC_WORKERS);
        setWorkers(Array.isArray(fallback) ? fallback : (fallback.data || []));
      } catch (fallbackError) {
        console.error('Error fetching workers:', fallbackError);
        setWorkers([]);
      }
    }
  };
  
  // Handlers
  const handleStatusUpdate = async (bookingId, newStatus) => {
    try {
      let successMessage = '';
      
      await updateBooking(bookingId, { status: newStatus });
      
      // Set appropriate success message
      switch (newStatus) {
        case 'scheduled':
          successMessage = 'Booking scheduled successfully!';
          break;
        case 'in-progress':
          successMessage = 'Service started successfully!';
          break;
        case 'completed':
          successMessage = 'Service completed successfully!';
          break;
        case 'cancelled':
          successMessage = 'Booking cancelled successfully!';
          break;
        default:
          successMessage = 'Booking status updated successfully!';
      }
      
      // Show success message
      toast.success(successMessage);
      
    } catch (error) {
      console.error('Error updating booking status:', error);
      
      // Enhanced error handling
      let errorMessage = 'Failed to update booking status. Please try again.';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(`Error: ${errorMessage}`);
      
      // Re-throw to allow caller to handle if needed
      throw error;
    }
  };
  
  const handleEdit = (booking) => {
    setEditingBooking(booking);
    setShowForm(true);
  };
  
  const handleDelete = async (bookingId) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      try {
        await deleteBooking(bookingId);
      } catch (error) {
        console.error('Error deleting booking:', error);
      }
    }
  };
  
  const handleApproveBooking = async (bookingId) => {
    try {
      await approveBooking(bookingId);
    } catch (error) {
      console.error('Error approving booking:', error);
    }
  };
  
  const handleAssignWorker = (booking) => {
    try {
      setSelectedBookingForWorker(booking);
      setShowWorkerModal(true);
    } catch (error) {
      console.error('Error opening worker assignment modal:', error);
      handleError(error, 'Failed to open worker assignment. Please try again.');
    }
  };
  
  const handleRemoveWorker = (booking) => {
    try {
      setSelectedBookingForWorker(booking);
      setShowWorkerRemovalModal(true);
    } catch (error) {
      console.error('Error opening worker removal modal:', error);
      handleError(error, 'Failed to open worker removal. Please try again.');
    }
  };
  
  const handleWorkerAssignmentSuccess = () => {
    setShowWorkerModal(false);
    setSelectedBookingForWorker(null);
    fetchBookings();
    
    // If we need to proceed to POS after assignment, navigate there
    if (proceedToPOSAfterAssignment && selectedBookingForWorker) {
      setProceedToPOSAfterAssignment(false);
      navigate(`/pos?customer_id=${selectedBookingForWorker.customer_id}&booking_id=${selectedBookingForWorker.id}&booking_number=${selectedBookingForWorker.booking_number}`);
    }
  };
  
  const handleWorkerRemovalSuccess = () => {
    setShowWorkerRemovalModal(false);
    setSelectedBookingForWorker(null);
    fetchBookings();
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (formData.customer_type) {
        formData.customer_type = normalizeCustomerType(formData.customer_type);
      }
      
      if (editingBooking) {
        await updateBooking(editingBooking.id, formData);
      } else {
        await createBooking(formData);
      }
      setShowForm(false);
      setEditingBooking(null);
    } catch (error) {
      console.error('Error saving booking:', error);
      throw error;
    }
  };
  
  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCustomerTypeFilter('all');
    setDateFilter('all');
  };
  
  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Bookings</h3>
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchBookings}
          className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium"
        >
          Retry
        </button>
      </div>
    );
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated()) {
    return (
      <div className="w-full mx-auto px-2 sm:px-3 lg:px-4 py-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-medium text-yellow-800 mb-2">Authentication Required</h3>
          <p className="text-yellow-700 mb-4">
            Please log in to access the booking management system.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md font-medium"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }
  
  // Check if user has manager or admin role for enhanced features
  const isManagerOrAdmin = hasRole('admin') || hasRole('manager');
 
  if (!isManagerOrAdmin) {
    return (
    <div className="w-full mx-auto px-2 sm:px-3 lg:px-4 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-700 mb-4">
            You do not have permission to access the enhanced booking management system.
            This feature is restricted to managers and administrators only.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  if (hasError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold">Bookings Rendering Error</h3>
          <p className="text-red-600">Something went wrong displaying bookings. Please refresh the page.</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium"
            >
              Refresh Page
            </button>
            <button
              onClick={() => {
                setHasError(false);
                fetchBookings();
              }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  try {
    return (
      <div className="w-full mx-auto px-2 sm:px-3 lg:px-4 py-6">
        <BookingsHeader
          todaysBookings={todaysBookings}
          onNewBooking={() => {
            setEditingBooking(null);
            setShowForm(true);
          }}
        />
        <BookingsFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          customerTypeFilter={customerTypeFilter}
          onCustomerTypeChange={setCustomerTypeFilter}
          dateFilter={dateFilter}
          onDateChange={setDateFilter}
          onClearFilters={handleClearFilters}
        />
        <div className="mb-8 overflow-x-visible">
          <BookingsTable
            bookings={filteredBookings}
            loading={loading}
            onStatusUpdate={handleStatusUpdate}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAssignWorker={handleAssignWorker}
            onRemoveWorker={handleRemoveWorker}
            showQueueOrder={true}
            processingPayment={processingPayment}
            setProcessingPayment={setProcessingPayment}
          />
        </div>
        <BookingsSummary bookings={filteredBookings} />
        {showForm && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
              <BookingForm
                booking={editingBooking}
                services={services}
                workers={workers}
                bookings={bookings}
                onSubmit={handleFormSubmit}
                onCancel={() => {
                  setShowForm(false);
                  setEditingBooking(null);
                }}
              />
            </div>
          </div>
        )}
        {showWorkerModal && selectedBookingForWorker && (
          <WorkerAssignmentModal
            booking={selectedBookingForWorker}
            onClose={() => {
              setShowWorkerModal(false);
              setSelectedBookingForWorker(null);
            }}
            onSuccess={handleWorkerAssignmentSuccess}
          />
        )}
        {showWorkerRemovalModal && selectedBookingForWorker && (
          <WorkerRemovalModal
            booking={selectedBookingForWorker}
            onClose={() => {
              setShowWorkerRemovalModal(false);
              setSelectedBookingForWorker(null);
            }}
            onSuccess={handleWorkerRemovalSuccess}
          />
        )}
      </div>
    );
  } catch (renderError) {
    console.error('Bookings rendering error:', renderError);
    setHasError(true);
    return null;
  }
};

export default Bookings;
export { BookingsTable };
