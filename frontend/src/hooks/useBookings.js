import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiDelete, apiPatch, API_ENDPOINTS, isAuthenticated, API_BASE_URL } from '../utils/api';

export const useBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Require authentication for all booking operations
      if (!isAuthenticated()) {
        throw new Error('Authentication required to access bookings');
      }
      const data = await apiGet(API_ENDPOINTS.BOOKINGS);
      setBookings(Array.isArray(data) ? data : (data.data || []));
      setLoading(false);
    } catch (err) {
      setError(err.message || 'Failed to fetch bookings');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const createBooking = async (bookingData) => {
    try {
      // Require authentication for all booking operations
      if (!isAuthenticated()) {
        throw new Error('Authentication required to create bookings');
      }
      const newBooking = await apiPost(API_ENDPOINTS.BOOKINGS, bookingData);
      setBookings(prev => [...prev, newBooking]);
      return newBooking;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateBooking = async (id, updatedData) => {
    try {
      // Require authentication for updates
      if (!isAuthenticated()) {
        throw new Error('Authentication required to update bookings');
      }
      const updatedBooking = await apiPatch(`${API_ENDPOINTS.BOOKINGS}/${id}`, updatedData);
      setBookings(prev => prev.map(booking => 
        booking.id === id ? updatedBooking : booking
      ));
      return updatedBooking;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteBooking = async (id) => {
    try {
      // Require authentication for deletes
      if (!isAuthenticated()) {
        throw new Error('Authentication required to delete bookings');
      }
      
      await apiDelete(`${API_ENDPOINTS.BOOKINGS}/${id}`);
      setBookings(prev => prev.filter(booking => booking.id !== id));
    } catch (error) {
      console.error('Error deleting booking:', error);
      throw error;
    }
  };

  const updatePaymentStatus = async (id, paymentStatus) => {
    try {
      if (!isAuthenticated()) {
        throw new Error('Authentication required to update payment status');
      }
      const updatedBooking = await apiPatch(API_ENDPOINTS.BOOKING_PAYMENT_STATUS(id), { payment_status: paymentStatus });
      setBookings(prev => prev.map(booking => 
        booking.id === id ? updatedBooking : booking
      ));
      return updatedBooking;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const assignMultipleWorkers = async (id, workerIds) => {
    try {
      if (!isAuthenticated()) {
        throw new Error('Authentication required to assign workers');
      }
      // Convert worker IDs array to workers array with role (default to 'primary')
      const workers = workerIds.map(worker_id => ({
        worker_id,
        role: 'primary'
      }));
      const updatedBooking = await apiPost(API_ENDPOINTS.BOOKING_ASSIGN_WORKERS(id), { workers });
      setBookings(prev => prev.map(booking => 
        booking.id === id ? updatedBooking : booking
      ));
      return updatedBooking;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const getBookingWaitTime = async (id) => {
    try {
      if (!isAuthenticated()) {
        throw new Error('Authentication required to get wait time');
      }
      const data = await apiGet(API_ENDPOINTS.BOOKING_WAIT_TIME(id));
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const getBookingWorkers = async (id) => {
    try {
      if (!isAuthenticated()) {
        throw new Error('Authentication required to get booking workers');
      }
      const data = await apiGet(API_ENDPOINTS.BOOKING_WORKERS(id));
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const approveBooking = async (id) => {
    try {
      if (!isAuthenticated()) {
        throw new Error('Authentication required to approve bookings');
      }
      const approvedBooking = await apiPost(API_ENDPOINTS.BOOKING_APPROVE(id));
      setBookings(prev => prev.map(booking => 
        booking.id === id ? approvedBooking : booking
      ));
      return approvedBooking;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  return {
    bookings,
    loading,
    error,
    createBooking,
    updateBooking,
    deleteBooking,
    updatePaymentStatus,
    assignMultipleWorkers,
    getBookingWaitTime,
    getBookingWorkers,
    approveBooking,
    refetch: fetchBookings
  };
};