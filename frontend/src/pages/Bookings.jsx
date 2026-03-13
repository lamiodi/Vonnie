import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookings } from '@/hooks/useBookings';
import { useAuth } from '@/contexts/AuthContext';
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  API_ENDPOINTS,
  isAuthenticated
} from '../utils/api';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { toast } from 'react-hot-toast';
import {
  getCustomerTypeLabel,
  getCustomerTypeColor,
  normalizeCustomerType
} from '@/utils/bookingUtils';
import BookingForm from '../components/BookingForm';

// ============================================
// Constants
// ============================================

const STATUS_CONFIG = {
  pending_confirmation: { text: 'Pending Confirmation', classes: 'bg-yellow-100 text-yellow-800' },
  scheduled: { text: 'Scheduled', classes: 'bg-blue-100 text-blue-800' },
  'in-progress': { text: 'In Progress', classes: 'bg-indigo-100 text-indigo-800' },
  completed: { text: 'Completed', classes: 'bg-green-100 text-green-800' },
  cancelled: { text: 'Cancelled', classes: 'bg-red-100 text-red-800' }
};

const PAYMENT_STATUS_CONFIG = {
  completed: { text: 'Paid', classes: 'bg-green-100 text-green-800' },
  pending: { text: 'Pending', classes: 'bg-yellow-100 text-yellow-800' },
  failed: { text: 'Failed', classes: 'bg-red-100 text-red-800' },
  refunded: { text: 'Refunded', classes: 'bg-gray-100 text-gray-800' }
};

// ============================================
// Utility Functions
// ============================================

const getTodayDateRange = () => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { startOfDay, endOfDay };
};

const isToday = (date) => {
  const { startOfDay, endOfDay } = getTodayDateRange();
  const d = new Date(date);
  return d >= startOfDay && d < endOfDay;
};

// ============================================
// Badge Components
// ============================================

const BookingStatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || { text: status || 'Unknown', classes: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}>
      {config.text}
    </span>
  );
};

const PaymentStatusBadge = ({ status }) => {
  const config = PAYMENT_STATUS_CONFIG[status] || { text: status || 'Unknown', classes: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}>
      {config.text}
    </span>
  );
};

// ============================================
// BookingsFilters Component
// ============================================

const BookingsFilters = ({
  searchTerm = '',
  onSearchChange,
  statusFilter = 'all',
  onStatusChange,
  customerTypeFilter = 'all',
  onCustomerTypeChange,
  dateFilter = 'all',
  onDateChange,
  onClearFilters
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <input
            type="text"
            placeholder="Search by customer, booking #, service..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Booking Status</label>
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Customer Type</label>
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
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
              <button onClick={() => onSearchChange('')} className="ml-2 text-blue-600 hover:text-blue-800">×</button>
            </span>
          )}
          {statusFilter !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Status: {statusFilter.replace('_', ' ')}
              <button onClick={() => onStatusChange('all')} className="ml-2 text-green-600 hover:text-green-800">×</button>
            </span>
          )}
          {customerTypeFilter !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Customer: {getCustomerTypeLabel(customerTypeFilter)}
              <button onClick={() => onCustomerTypeChange('all')} className="ml-2 text-purple-600 hover:text-purple-800">×</button>
            </span>
          )}
          {dateFilter !== 'all' && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              Date: {dateFilter.replace('-', ' ')}
              <button onClick={() => onDateChange('all')} className="ml-2 text-orange-600 hover:text-orange-800">×</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// BookingsHeader Component
// ============================================

const BookingsHeader = ({ todaysBookings = [] }) => {
  const navigate = useNavigate();

  const stats = useMemo(() => {
    return {
      total: todaysBookings.length,
      scheduled: todaysBookings.filter(b => b.status === 'scheduled').length,
      inProgress: todaysBookings.filter(b => b.status === 'in-progress').length,
      completed: todaysBookings.filter(b => b.status === 'completed').length,
      cancelled: todaysBookings.filter(b => b.status === 'cancelled').length,
      awaitingPayment: todaysBookings.filter(b => b.payment_status !== 'completed' && b.status !== 'cancelled' && b.status !== 'completed').length
    };
  }, [todaysBookings]);

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
            onClick={() => navigate('/public-booking')}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Booking
          </button>
          <button
            onClick={() => navigate('/walk-in-booking')}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md font-medium inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Walk-in Mode
          </button>
        </div>
      </div>

      {/* Today's Overview */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Today's Bookings Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600 mt-1">Total</div>
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
        </div>
      </div>

      {/* Queue Dashboard */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Queue Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.awaitingPayment}</div>
                <div className="text-sm text-red-700 font-medium">Awaiting Payment</div>
              </div>
              <div className="text-red-500 text-2xl">💳</div>
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-orange-600">{stats.scheduled}</div>
                <div className="text-sm text-orange-700 font-medium">Ready for Service</div>
              </div>
              <div className="text-orange-500 text-2xl">⏰</div>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
                <div className="text-sm text-blue-700 font-medium">In Progress</div>
              </div>
              <div className="text-blue-500 text-2xl">✂️</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// BookingsSummary Component
// ============================================

const BookingsSummary = ({ bookings = [] }) => {
  if (!bookings.length) return null;

  const summary = useMemo(() => ({
    total: bookings.length,
    revenue: bookings.reduce((sum, b) => sum + parseFloat(b.total_amount || 0), 0),
    scheduled: bookings.filter(b => b.status === 'scheduled').length,
    pending: bookings.filter(b => b.status === 'pending_confirmation').length
  }), [bookings]);

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
        <StatCard title="Total Bookings" value={summary.total} color="blue" />
        <StatCard title="Total Revenue" value={formatCurrency(summary.revenue)} color="green" />
        <StatCard title="Scheduled" value={summary.scheduled} color="yellow" />
        <StatCard title="Pending Confirmation" value={summary.pending} color="red" />
      </div>
    </div>
  );
};

// ============================================
// BookingsTable Component
// ============================================

const BookingsTable = ({
  bookings = [],
  loading = false,
  onStatusUpdate,
  onEdit,
  onDelete,
  onAssignWorker,
  onRemoveWorker,
  onViewNote,
  showQueueOrder = false,
  processingPayment = new Set(),
  onProcessPayment
}) => {
  const navigate = useNavigate();
  const [selectedBookings, setSelectedBookings] = useState(new Set());

  const handleSelectAll = useCallback(() => {
    if (selectedBookings.size === bookings.length) {
      setSelectedBookings(new Set());
    } else {
      setSelectedBookings(new Set(bookings.map(b => b.id)));
    }
  }, [bookings, selectedBookings.size]);

  const handleSelectBooking = useCallback((bookingId) => {
    setSelectedBookings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  }, []);

  const handleBulkCancel = useCallback(() => {
    selectedBookings.forEach(id => onStatusUpdate(id, 'cancelled'));
    setSelectedBookings(new Set());
  }, [selectedBookings, onStatusUpdate]);

  const getCustomerDisplayData = useCallback((booking) => {
    if (booking.customer_name) {
      return { name: booking.customer_name, phone: booking.customer_phone };
    }
    if (booking.customer) {
      return {
        name: `${booking.customer.first_name || ''} ${booking.customer.last_name || ''}`.trim() || 'Unknown',
        phone: booking.customer.phone
      };
    }
    return { name: 'Unknown Customer', phone: 'N/A' };
  }, []);

  const getQueuePosition = useCallback((booking, allBookings) => {
    if (!showQueueOrder || !isToday(booking.scheduled_time)) return null;

    const activeBookings = allBookings.filter(b =>
      isToday(b.scheduled_time) && !['completed', 'cancelled'].includes(b.status)
    );

    const sorted = [...activeBookings].sort((a, b) => {
      // Payment priority: unpaid first
      const aPayment = a.payment_status === 'completed' ? 1 : 0;
      const bPayment = b.payment_status === 'completed' ? 1 : 0;
      if (aPayment !== bPayment) return aPayment - bPayment;

      // Customer type: walk-in first
      const aType = normalizeCustomerType(a.customer_type);
      const bType = normalizeCustomerType(b.customer_type);
      const isAWalkIn = !a.customer_id || aType === 'walk_in';
      const isBWalkIn = !b.customer_id || bType === 'walk_in';
      if (isAWalkIn !== isBWalkIn) return isAWalkIn ? -1 : 1;

      // Time: earlier first
      return new Date(a.scheduled_time) - new Date(b.scheduled_time);
    });

    const position = sorted.findIndex(b => b.id === booking.id);
    return position >= 0 ? position + 1 : null;
  }, [showQueueOrder]);

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
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No bookings found</h3>
        <p className="mt-1 text-sm text-gray-500">No bookings match your current filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Bulk Actions */}
      {selectedBookings.size > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">
              {selectedBookings.size} booking{selectedBookings.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={handleBulkCancel}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded"
              >
                Cancel Selected
              </button>
              <button
                onClick={() => setSelectedBookings(new Set())}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedBookings.size === bookings.length && bookings.length > 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Booking #</th>
              {showQueueOrder && <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Queue</th>}
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Worker</th>
              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase">Note</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bookings.map((booking) => {
              const customer = getCustomerDisplayData(booking);
              const queuePos = getQueuePosition(booking, bookings);
              const hasWorkers = booking.workers?.length > 0;
              const isProcessing = processingPayment.has(booking.id);

              return (
                <tr key={booking.id} className="hover:bg-gray-50">
                  <td className="px-3 py-4">
                    <input
                      type="checkbox"
                      checked={selectedBookings.has(booking.id)}
                      onChange={() => handleSelectBooking(booking.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap font-medium text-gray-900">
                    #{booking.booking_number}
                  </td>
                  {showQueueOrder && (
                    <td className="px-3 py-4 whitespace-nowrap">
                      {queuePos ? (
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                          queuePos === 1 ? 'bg-green-100 text-green-800' :
                          queuePos <= 3 ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          #{queuePos}
                        </span>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                  )}
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 truncate max-w-[140px]">{customer.name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[140px]">{customer.phone}</div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-gray-900">
                    <div className="truncate max-w-[140px]">
                      {booking.service_names?.join(', ') || booking.service_name || 'N/A'}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-gray-900 text-xs">
                    {formatDateTime(booking.scheduled_time)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    {hasWorkers ? (
                      <div className="font-medium text-gray-900 text-sm truncate max-w-[120px]">
                        {booking.workers[0].worker_name}
                        {booking.workers.length > 1 && <span className="text-xs text-gray-500 ml-1">+{booking.workers.length - 1}</span>}
                      </div>
                    ) : (
                      <span className="text-gray-400 italic text-sm">Unassigned</span>
                    )}
                  </td>
                  <td className="px-2 py-4 whitespace-nowrap text-center">
                    {booking.notes ? (
                      <button
                        onClick={() => onViewNote(booking.notes)}
                        className="text-gray-400 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50"
                        title="View Note"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCustomerTypeColor(normalizeCustomerType(booking.customer_type))}`}>
                      {getCustomerTypeLabel(normalizeCustomerType(booking.customer_type))}
                    </span>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <BookingStatusBadge status={booking.status} />
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <PaymentStatusBadge status={booking.payment_status} />
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap font-medium text-gray-900">
                    {formatCurrency(booking.total_amount)}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {/* Payment Button */}
                      {booking.payment_status !== 'completed' && (
                        <button
                          onClick={() => onProcessPayment(booking)}
                          disabled={isProcessing}
                          className={`inline-flex items-center px-2 py-1 text-xs font-semibold text-white rounded ${
                            isProcessing ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {isProcessing ? 'Processing...' : '💳 Pay'}
                        </button>
                      )}
                      
                      {/* Status Actions */}
                      {booking.status === 'scheduled' && (
                        <button
                          onClick={() => onStatusUpdate(booking.id, 'in-progress')}
                          className="inline-flex items-center px-2 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded"
                        >
                          Start
                        </button>
                      )}
                      
                      {booking.status === 'in-progress' && (
                        <button
                          onClick={() => onStatusUpdate(booking.id, 'completed')}
                          className="inline-flex items-center px-2 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded"
                        >
                          Done
                        </button>
                      )}
                      
                      {/* Worker Assignment */}
                      {!['cancelled', 'completed'].includes(booking.status) && (
                        <button
                          onClick={() => onAssignWorker(booking)}
                          className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-purple-700 border border-purple-300 rounded hover:bg-purple-50"
                        >
                          {hasWorkers ? '👷 Reassign' : '👷 Assign'}
                        </button>
                      )}
                      
                      {/* Cancel */}
                      {!['cancelled', 'completed'].includes(booking.status) && (
                        <button
                          onClick={() => onStatusUpdate(booking.id, 'cancelled')}
                          className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-red-700 border border-red-300 rounded hover:bg-red-50"
                        >
                          🚫 Cancel
                        </button>
                      )}
                      
                      {/* Edit/Delete */}
                      <button
                        onClick={() => onEdit(booking)}
                        className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-300 rounded hover:bg-blue-50"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onDelete(booking.id)}
                        className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-red-700 border border-red-300 rounded hover:bg-red-50"
                      >
                        🗑️
                      </button>
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

// ============================================
// WorkerAssignmentModal Component
// ============================================

const WorkerAssignmentModal = ({ booking, onClose, onSuccess }) => {
  const [workers, setWorkers] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [currentWorkers, setCurrentWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!booking) return;

    const fetchData = async () => {
      setDataLoading(true);
      setError('');

      try {
        const [workersData, currentData] = await Promise.all([
          apiGet(API_ENDPOINTS.WORKERS),
          apiGet(API_ENDPOINTS.BOOKING_WORKERS(booking.id))
        ]);

        const workerList = Array.isArray(workersData) ? workersData : workersData.data || [];
        const currentList = Array.isArray(currentData) ? currentData : currentData.data || [];

        setWorkers(workerList);
        setCurrentWorkers(currentList);
        setSelectedWorkers(currentList.map(w => w.worker_id));
      } catch (err) {
        console.error('Error fetching worker data:', err);
        setError('Failed to load workers. Please try again.');
        setWorkers([]);
        setCurrentWorkers([]);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [booking]);

  const handleWorkerToggle = useCallback((workerId) => {
    setSelectedWorkers(prev => {
      if (prev.includes(workerId)) {
        return prev.filter(id => id !== workerId);
      }
      return [...prev, workerId];
    });
  }, []);

  const handleAssign = async () => {
    if (selectedWorkers.length === 0) {
      setError('Please select at least one worker');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const assignmentWorkers = selectedWorkers.map(workerId => ({
        worker_id: workerId,
        role: 'primary'
      }));

      await apiPost(API_ENDPOINTS.BOOKING_ASSIGN_WORKERS(booking.id), { workers: assignmentWorkers });

      // Auto-start if scheduled
      if (booking.status === 'scheduled') {
        try {
          await apiPatch(API_ENDPOINTS.BOOKING_STATUS(booking.id), { status: 'in-progress' });
          toast.success('Worker assigned and service started');
        } catch {
          toast.success('Worker assigned successfully');
        }
      } else {
        toast.success('Worker assigned successfully');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error assigning workers:', err);
      setError(err.response?.data?.error || 'Failed to assign workers');
    } finally {
      setLoading(false);
    }
  };

  if (!booking) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Assign Workers</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Booking Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-600">Booking:</span> <span className="font-medium">#{booking.booking_number}</span></div>
            <div><span className="text-gray-600">Customer:</span> <span className="font-medium">{booking.customer_name}</span></div>
            <div className="col-span-2"><span className="text-gray-600">Service:</span> <span className="font-medium">{booking.service_names?.join(', ') || booking.service_name}</span></div>
          </div>
        </div>

        {/* Worker Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Workers ({selectedWorkers.length} selected)
          </label>
          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
            {dataLoading ? (
              <div className="text-center py-4 text-gray-500">Loading workers...</div>
            ) : workers.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No workers available</div>
            ) : (
              workers.filter(w => w.status !== 'inactive').map(worker => {
                const isSelected = selectedWorkers.includes(worker.id);
                const isCurrent = currentWorkers.some(cw => cw.worker_id === worker.id);

                return (
                  <div
                    key={worker.id}
                    onClick={() => handleWorkerToggle(worker.id)}
                    className={`p-3 rounded-md border cursor-pointer transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{worker.name}</div>
                        <div className="text-sm text-gray-600">{worker.role}</div>
                      </div>
                      <div className="flex gap-2">
                        {isSelected && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Selected</span>
                        )}
                        {isCurrent && !isSelected && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Current</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
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
            onClick={handleAssign}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
            disabled={loading || selectedWorkers.length === 0}
          >
            {loading ? 'Assigning...' : `Assign ${selectedWorkers.length} Worker${selectedWorkers.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// NoteModal Component
// ============================================

const NoteModal = ({ note, onClose }) => {
  if (!note) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">📝</span> Booking Note
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="bg-yellow-50 rounded-xl p-5 mb-6 border border-yellow-100 max-h-[60vh] overflow-y-auto">
          <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{note}</p>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-bold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Main Bookings Component
// ============================================

const Bookings = () => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const { bookings, loading, error, createBooking, updateBooking, deleteBooking, approveBooking, refetch } = useBookings();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(new Set());
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [services, setServices] = useState([]);
  const [workers, setWorkers] = useState([]);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
    }
  }, [navigate]);

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      try {
        await refetch();

        // Fetch services and workers in parallel
        const [servicesData, workersData] = await Promise.allSettled([
          apiGet(API_ENDPOINTS.SERVICES).catch(() => apiGet(API_ENDPOINTS.PUBLIC_SERVICES)),
          apiGet(API_ENDPOINTS.WORKERS).catch(() => apiGet(API_ENDPOINTS.PUBLIC_WORKERS))
        ]);

        if (servicesData.status === 'fulfilled') {
          setServices(Array.isArray(servicesData.value) ? servicesData.value : servicesData.value?.data || []);
        }
        if (workersData.status === 'fulfilled') {
          setWorkers(Array.isArray(workersData.value) ? workersData.value : []);
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
      }
    };

    fetchData();
  }, [refetch]);

  // Filtered and sorted bookings
  const filteredBookings = useMemo(() => {
    if (!bookings) return [];

    const { startOfDay, endOfDay } = getTodayDateRange();
    const tomorrow = new Date(endOfDay);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(startOfDay);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonth = new Date(startOfDay);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    return bookings.filter(booking => {
      // Search
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const customerName = booking.customer_name || `${booking.customer?.first_name || ''} ${booking.customer?.last_name || ''}`.trim();
        const matches =
          customerName.toLowerCase().includes(search) ||
          (booking.customer_email?.toLowerCase().includes(search)) ||
          (booking.customer_phone?.toLowerCase().includes(search)) ||
          (booking.booking_number?.toLowerCase().includes(search)) ||
          (booking.service_name?.toLowerCase().includes(search)) ||
          (booking.service_names?.some(s => s.toLowerCase().includes(search)));
        if (!matches) return false;
      }

      // Status
      if (statusFilter !== 'all' && booking.status !== statusFilter) return false;

      // Customer type
      if (customerTypeFilter !== 'all') {
        const type = normalizeCustomerType(booking.customer_type);
        const isWalkIn = type === 'walk_in' || !booking.customer_id;
        if (customerTypeFilter === 'walk_in' && !isWalkIn) return false;
        if (customerTypeFilter === 'pre_booked' && isWalkIn) return false;
      }

      // Date
      if (dateFilter !== 'all') {
        const bookingDate = new Date(booking.scheduled_time);
        switch (dateFilter) {
          case 'today':
            if (bookingDate < startOfDay || bookingDate >= endOfDay) return false;
            break;
          case 'tomorrow':
            if (bookingDate < endOfDay || bookingDate >= tomorrow) return false;
            break;
          case 'this-week':
            if (bookingDate < startOfDay || bookingDate >= nextWeek) return false;
            break;
          case 'this-month':
            if (bookingDate < startOfDay || bookingDate >= nextMonth) return false;
            break;
        }
      }

      return true;
    }).sort((a, b) => {
      // Today first
      const aToday = isToday(a.scheduled_time);
      const bToday = isToday(b.scheduled_time);
      if (aToday && !bToday) return -1;
      if (!aToday && bToday) return 1;

      // Unpaid first
      if (a.payment_status !== 'completed' && b.payment_status === 'completed') return -1;
      if (a.payment_status === 'completed' && b.payment_status !== 'completed') return 1;

      // By scheduled time
      return new Date(a.scheduled_time) - new Date(b.scheduled_time);
    });
  }, [bookings, searchTerm, statusFilter, customerTypeFilter, dateFilter]);

  // Today's bookings
  const todaysBookings = useMemo(() => {
    return (bookings || []).filter(b => isToday(b.scheduled_time));
  }, [bookings]);

  // Handlers
  const handleStatusUpdate = useCallback(async (bookingId, newStatus) => {
    try {
      await updateBooking(bookingId, { status: newStatus });
      const messages = {
        scheduled: 'Booking scheduled',
        'in-progress': 'Service started',
        completed: 'Service completed',
        cancelled: 'Booking cancelled'
      };
      toast.success(messages[newStatus] || 'Status updated');
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  }, [updateBooking]);

  const handleEdit = useCallback((booking) => {
    setEditingBooking(booking);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(async (bookingId) => {
    if (window.confirm('Are you sure you want to delete this booking?')) {
      try {
        await deleteBooking(bookingId);
        toast.success('Booking deleted');
      } catch (err) {
        console.error('Error deleting booking:', err);
        toast.error('Failed to delete booking');
      }
    }
  }, [deleteBooking]);

  const handleAssignWorker = useCallback((booking) => {
    setSelectedBooking(booking);
    setShowWorkerModal(true);
  }, []);

  const handleProcessPayment = useCallback(async (booking) => {
    setProcessingPayment(prev => new Set(prev).add(booking.id));

    try {
      // Approve if pending
      if (booking.status === 'pending_confirmation') {
        try {
          await approveBooking(booking.id);
        } catch (e) {
          console.warn('Could not auto-approve booking:', e);
        }
      }

      // Check worker assignment
      if (!booking.worker_id) {
        toast.error('Please assign a worker before processing payment');
        setSelectedBooking(booking);
        setShowWorkerModal(true);
        setProcessingPayment(prev => {
          const next = new Set(prev);
          next.delete(booking.id);
          return next;
        });
        return;
      }

      // Navigate to POS
      navigate(`/pos?customer_id=${booking.customer_id}&booking_id=${booking.id}&booking_number=${booking.booking_number}`);
    } catch (err) {
      console.error('Error processing payment:', err);
      toast.error('Failed to process payment');
    } finally {
      setProcessingPayment(prev => {
        const next = new Set(prev);
        next.delete(booking.id);
        return next;
      });
    }
  }, [approveBooking, navigate]);

  const handleViewNote = useCallback((note) => {
    setSelectedNote(note);
    setShowNoteModal(true);
  }, []);

  const handleFormSubmit = useCallback(async (formData) => {
    try {
      const data = {
        ...formData,
        customer_type: formData.customer_type ? normalizeCustomerType(formData.customer_type) : undefined
      };

      if (editingBooking) {
        await updateBooking(editingBooking.id, data);
        toast.success('Booking updated');
      } else {
        await createBooking(data);
        toast.success('Booking created');
      }

      setShowForm(false);
      setEditingBooking(null);
    } catch (err) {
      console.error('Error saving booking:', err);
      toast.error(err.response?.data?.error || 'Failed to save booking');
      throw err;
    }
  }, [editingBooking, updateBooking, createBooking]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setCustomerTypeFilter('all');
    setDateFilter('all');
  }, []);

  // Permission check
  const isManagerOrAdmin = hasRole('admin') || hasRole('manager');

  if (!isAuthenticated()) {
    return (
      <div className="w-full mx-auto px-4 py-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-medium text-yellow-800 mb-2">Authentication Required</h3>
          <p className="text-yellow-700 mb-4">Please log in to access bookings.</p>
          <button onClick={() => navigate('/login')} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md font-medium">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!isManagerOrAdmin) {
    return (
      <div className="w-full mx-auto px-4 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-700 mb-4">You need manager or admin privileges to access this page.</p>
          <button onClick={() => navigate('/dashboard')} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold">Error Loading Bookings</h3>
          <p className="text-red-600">{error}</p>
          <button onClick={refetch} className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-2 sm:px-3 lg:px-4 py-6">
      <BookingsHeader todaysBookings={todaysBookings} />

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

      <div className="mb-8 overflow-x-auto">
        <BookingsTable
          bookings={filteredBookings}
          loading={loading}
          onStatusUpdate={handleStatusUpdate}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAssignWorker={handleAssignWorker}
          onRemoveWorker={handleAssignWorker}
          onViewNote={handleViewNote}
          showQueueOrder={true}
          processingPayment={processingPayment}
          onProcessPayment={handleProcessPayment}
        />
      </div>

      <BookingsSummary bookings={filteredBookings} />

      {/* Booking Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white rounded-t-xl sm:rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
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

      {/* Worker Assignment Modal */}
      {showWorkerModal && selectedBooking && (
        <WorkerAssignmentModal
          booking={selectedBooking}
          onClose={() => {
            setShowWorkerModal(false);
            setSelectedBooking(null);
          }}
          onSuccess={refetch}
        />
      )}

      {/* Note Modal */}
      {showNoteModal && (
        <NoteModal
          note={selectedNote}
          onClose={() => {
            setShowNoteModal(false);
            setSelectedNote(null);
          }}
        />
      )}
    </div>
  );
};

export default Bookings;
export { BookingsTable };