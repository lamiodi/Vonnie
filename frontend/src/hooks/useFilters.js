/**
 * useFilters Hook
 * Manages filter and search states for bookings
 */

import { useState, useMemo } from 'react';
import { useDebounce } from '@/utils/hooks';

export const useFilters = (bookings) => {
  const [filters, setFilters] = useState({
    status: 'all',
    customerType: 'all',
    date: 'all',
    search: '',
  });

  const debouncedSearch = useDebounce(filters.search, 300);

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      // Status filter
      if (filters.status !== 'all' && booking.status !== filters.status) {
        return false;
      }

      // Customer type filter
      if (filters.customerType !== 'all' && booking.customer_type !== filters.customerType) {
        return false;
      }

      // Date filter
      if (filters.date !== 'all') {
        const today = new Date();
        const bookingDate = new Date(booking.scheduled_time);
        today.setHours(0, 0, 0, 0);
        bookingDate.setHours(0, 0, 0, 0);

        if (filters.date === 'today' && bookingDate.getTime() !== today.getTime()) {
          return false;
        }
        // Add other date filters like 'tomorrow', 'this_week', etc.
      }

      // Search filter
      if (debouncedSearch) {
        const searchTerm = debouncedSearch.toLowerCase();
        const customerName = booking.customer?.name?.toLowerCase() || '';
        const customerEmail = booking.customer?.email?.toLowerCase() || '';
        const workerName = booking.worker_name?.toLowerCase() || '';

        return (
          customerName.includes(searchTerm) ||
          customerEmail.includes(searchTerm) ||
          workerName.includes(searchTerm)
        );
      }

      return true;
    });
  }, [bookings, filters, debouncedSearch]);

  return { 
    filters, 
    handleFilterChange, 
    filteredBookings 
  };
};