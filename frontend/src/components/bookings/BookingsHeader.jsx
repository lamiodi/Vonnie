import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

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
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
        <div className="mb-4 md:mb-0">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Bookings Management</h1>
          <p className="mt-2 text-gray-600 mobile-text-base">Manage your salon bookings and appointments</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <button
            onClick={() => navigate('/public-booking')}
            className="bg-green-600 hover:bg-green-700 text-white px-3 md:px-4 py-2 rounded-md font-medium inline-flex items-center mobile-btn"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span className="mobile-text-sm">New Booking</span>
          </button>
          <button
            onClick={() => navigate('/walk-in-booking')}
            className="bg-purple-600 hover:bg-purple-700 text-white px-3 md:px-4 py-2 rounded-md font-medium inline-flex items-center mobile-btn"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="mobile-text-sm">Walk-in Mode</span>
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

export default BookingsHeader;
