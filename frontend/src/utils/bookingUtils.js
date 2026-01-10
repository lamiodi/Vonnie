// Utility functions for booking management

export const getTodaysBookings = (bookings) => {
  const today = new Date().toISOString().split('T')[0];
  return bookings.filter(booking => booking.date === today);
};

export const categorizeBookingsByStatus = (bookings) => {
  return bookings.reduce((acc, booking) => {
    const status = booking.status || 'pending_confirmation';
    if (!acc[status]) {
      acc[status] = [];
    }
    acc[status].push(booking);
    return acc;
  }, {});
};

export const calculateBookingStats = (bookings) => {
  const stats = {
    total: bookings.length,
    pending_confirmation: 0,
    scheduled: 0,
    'in-progress': 0,
    completed: 0,
    cancelled: 0,
    paid: 0,
    unpaid: 0,
    partial: 0
  };

  bookings.forEach(booking => {
    const status = booking.status || 'pending_confirmation';
    if (stats.hasOwnProperty(status)) {
      stats[status]++;
    }
    
    const paymentStatus = booking.payment_status || 'unpaid';
    if (stats.hasOwnProperty(paymentStatus)) {
      stats[paymentStatus]++;
    }
  });

  return stats;
};

export const formatBookingTime = (time) => {
  if (!time) return '';
  return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export const getBookingStatusColor = (status) => {
  const colors = {
    pending_confirmation: 'yellow',
    scheduled: 'blue',
    'in-progress': 'orange',
    completed: 'green',
    cancelled: 'red'
  };
  return colors[status] || 'gray';
};

export const getPaymentStatusColor = (status) => {
  const colors = {
    paid: 'green',
    unpaid: 'red',
    partial: 'yellow'
  };
  return colors[status] || 'gray';
};

// Date formatting utility
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Status utilities for new workflow
export const getStatusColor = (status) => {
  const colors = {
    'pending_confirmation': 'bg-yellow-100 text-yellow-800',
    'scheduled': 'bg-blue-100 text-blue-800',
    'in-progress': 'bg-indigo-100 text-indigo-800',
    'completed': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getStatusTooltip = (status) => {
  const tooltips = {
    'pending_confirmation': 'Booking pending confirmation',
    'scheduled': 'Booking confirmed and scheduled',
    'in-progress': 'Service is currently being performed',
    'completed': 'Service completed successfully',
    'cancelled': 'Booking has been cancelled',
  };
  return tooltips[status] || 'Unknown status';
};

export const getPaymentStatusTooltip = (status) => {
  const tooltips = {
    'paid': 'Payment completed in full',
    'unpaid': 'Payment pending',
    'partial': 'Partial payment received'
  };
  return tooltips[status] || 'Unknown payment status';
};

export const getArrivalStatusColor = (status) => {
  const colors = {
    'arrived': 'bg-green-100 text-green-800',
    'not_arrived': 'bg-gray-100 text-gray-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export const getQueueStatusColor = (status) => {
  const colors = {
    'waiting': 'bg-yellow-100 text-yellow-800',
    'in_progress': 'bg-blue-100 text-blue-800',
    'completed': 'bg-green-100 text-green-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

// Queue priority utilities - simplified: walk-ins first, then pre-booked
export const getQueuePriorityColor = (priority) => {
  const colors = {
    1: 'bg-blue-100 text-blue-800',    // Walk-in (highest)
    2: 'bg-yellow-100 text-yellow-800'  // Pre-booked (lower)
  };
  return colors[priority] || 'bg-gray-100 text-gray-800';
};

export const getQueuePriorityLabel = (priority) => {
  const labels = {
    1: 'Walk-in',
    2: 'Pre-booked'
  };
  return labels[priority] || 'Unknown';
};

export const getQueuePriorityTooltip = (priority) => {
  const tooltips = {
    1: 'Walk-in customer - processed first',
    2: 'Pre-booked customer - processed after walk-ins'
  };
  return tooltips[priority] || 'Unknown priority';
};

// Customer type utilities
export const getCustomerTypeLabel = (customerType) => {
  const labels = {
    'walk_in': 'Walk-in',
    'pre_booked': 'Pre-booked'
  };
  return labels[customerType] || 'Unknown';
};

export const getCustomerTypeColor = (customerType) => {
  const colors = {
    'walk_in': 'bg-orange-100 text-orange-800',
    'pre_booked': 'bg-blue-100 text-blue-800'
  };
  return colors[customerType] || 'bg-gray-100 text-gray-800';
};

export const isValidCustomerType = (type) => {
  return type === 'walk_in' || type === 'pre_booked';
};

export const normalizeCustomerType = (type) => {
  if (!type) return undefined;
  if (type === 'walk-in') return 'walk_in';
  if (type === 'pre-booked') return 'pre_booked';
  return type;
};