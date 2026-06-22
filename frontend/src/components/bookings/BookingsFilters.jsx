import React from 'react';
import { getCustomerTypeLabel } from '@/utils/bookingUtils';

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
        <div className="mobile-full-width">
          <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
          <input
            type="text"
            placeholder="Search by customer, booking #, service..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mobile-form-input"
          />
        </div>

        <div className="mobile-full-width">
          <label className="block text-sm font-medium text-gray-700 mb-2">Booking Status</label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mobile-form-input"
          >
            <option value="all">All Status</option>
            <option value="pending_confirmation">Pending Confirmation</option>
            <option value="scheduled">Scheduled</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="mobile-full-width">
          <label className="block text-sm font-medium text-gray-700 mb-2">Customer Type</label>
          <select
            value={customerTypeFilter}
            onChange={(e) => onCustomerTypeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mobile-form-input"
          >
            <option value="all">All Customers</option>
            <option value="walk_in">Walk-in</option>
            <option value="pre_booked">Pre-booked</option>
          </select>
        </div>

        <div className="mobile-full-width">
          <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
          <select
            value={dateFilter}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mobile-form-input"
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
              Search: &quot;{searchTerm}&quot;
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

export default BookingsFilters;
