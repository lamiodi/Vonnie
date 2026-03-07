import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { handleError, handleSuccess } from '../utils/errorHandler';
import { useAuth } from '../contexts/AuthContext';
import '@fontsource/patrick-hand';
import '@fontsource/unifrakturcook';

const PublicBooking = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isInternal = location.pathname.includes('public-booking') && user;

  // Form State
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    instagram_handle: '',
    booking_date: new Date(),
    booking_time: '',
    notes: ''
  });

  // UI State
  const [loading, setLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const slotsControllerRef = useRef(null);

  const endpoints = {
    availableSlots: '/api/public/bookings/available-slots',
    createBooking: '/api/public/bookings'
  };

  // Fetch available slots when date changes
  useEffect(() => {
    if (formData.booking_date) {
      fetchAvailableSlots();
    }
  }, [formData.booking_date]);

  const fetchAvailableSlots = async () => {
    if (slotsControllerRef.current) {
      try { slotsControllerRef.current.abort(); } catch (e) {}
    }
    
    setSlotsLoading(true);
    setSlotsError(null);
    setFormData(prev => ({ ...prev, booking_time: '' })); // Reset time selection
    
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller) {
      slotsControllerRef.current = controller;
    }

    try {
      const dateStr = new Date(formData.booking_date).toISOString().split('T')[0];
      // We don't send service_ids anymore, backend defaults to 60 mins duration
      const url = `${endpoints.availableSlots}?date=${dateStr}`;
      
      const response = await axios.get(url, { signal: controller?.signal, timeout: 15000 });
      
      let slots = [];
      if (Array.isArray(response.data)) {
        slots = response.data;
      } else if (response.data && typeof response.data === 'object') {
        slots = response.data.available_slots || response.data.slots || [];
      }
      
      setAvailableSlots(slots);
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error('Error fetching slots:', error);
      setSlotsError('Could not load available times. Please try another date.');
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleDateChange = (date) => {
    setFormData(prev => ({
      ...prev,
      booking_date: date,
      booking_time: ''
    }));
  };

  const handleTimeSelect = (timeSlot) => {
    // Extract HH:mm from ISO string or use directly if HH:mm
    let timeStr = timeSlot;
    if (timeSlot.includes('T')) {
      const date = new Date(timeSlot);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      timeStr = `${hours}:${minutes}`;
    }
    
    setFormData(prev => ({
      ...prev,
      booking_time: timeStr
    }));
    
    if (validationErrors.booking_time) {
      setValidationErrors(prev => ({ ...prev, booking_time: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.customer_name.trim()) errors.customer_name = 'Name is required';
    if (!formData.customer_phone.trim()) errors.customer_phone = 'Phone number is required';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.customer_email.trim()) {
      errors.customer_email = 'Email is required';
    } else if (!emailRegex.test(formData.customer_email)) {
      errors.customer_email = 'Please enter a valid email address';
    }

    if (!formData.instagram_handle.trim()) {
      errors.instagram_handle = 'Instagram handle is required';
    } else if (!formData.instagram_handle.startsWith('@')) {
      errors.instagram_handle = 'Handle must start with @ (e.g. @username)';
    }

    if (!formData.booking_date) errors.booking_date = 'Please select a date';
    if (!formData.booking_time) errors.booking_time = 'Please select a time';

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('.error-message');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    setLoading(true);

    try {
      const bookingDate = new Date(formData.booking_date);
      const dateStr = bookingDate.toISOString().split('T')[0];
      const scheduledTime = `${dateStr}T${formData.booking_time}:00`;
      
      const bookingData = {
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        instagram_handle: formData.instagram_handle,
        scheduled_time: scheduledTime,
        notes: formData.notes,
        payment_status: 'pending',
        customer_type: 'pre_booked',
        // Explicitly no services
        service_ids: []
      };
      
      const response = await axios.post(endpoints.createBooking, bookingData);
      const serverBookingData = response.data.data || response.data;

      // Navigate to confirmation
      navigate('/booking-confirmation', {
        state: { 
          bookingData: {
            ...serverBookingData,
            service_name: 'To be discussed in-shop'
          }, 
          paymentCompleted: false 
        }
      });
      
    } catch (error) {
      console.error('Error creating booking:', error);
      let errorMessage = 'Failed to create booking. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      handleError(error, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper to format time for display
  const formatTimeDisplay = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {isInternal && (
          <div className="mb-6">
            <button
              onClick={() => navigate('/bookings')}
              className="flex items-center text-gray-600 hover:text-gray-900 font-bold text-lg transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Bookings
            </button>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: '"UnifrakturCook", cursive' }}>
            Book Your Appointment
          </h1>
          <div className="bg-purple-100 border-l-4 border-purple-500 text-purple-700 p-4 rounded-r shadow-sm max-w-2xl mx-auto text-left">
            <p className="font-medium flex items-start gap-2">
              <span className="text-xl">ℹ️</span>
              <span>
                Select your preferred time below. <strong>Service selection and worker assignment will be handled in-shop</strong> by our manager during your visit.
              </span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            
            {/* Left Column: Contact Details */}
            <div className="p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2" style={{ fontFamily: '"UnifrakturCook", cursive' }}>
                <span className="text-purple-600">1.</span> Your Details
              </h2>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 rounded-xl border-2 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors ${validationErrors.customer_name ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-purple-500'}`}
                    placeholder="Jane Doe"
                  />
                  {validationErrors.customer_name && <p className="mt-1 text-sm text-red-500 error-message">{validationErrors.customer_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    name="customer_phone"
                    value={formData.customer_phone}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 rounded-xl border-2 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors ${validationErrors.customer_phone ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-purple-500'}`}
                    placeholder="08012345678"
                  />
                  {validationErrors.customer_phone && <p className="mt-1 text-sm text-red-500 error-message">{validationErrors.customer_phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    name="customer_email"
                    value={formData.customer_email}
                    onChange={handleInputChange}
                    className={`w-full px-4 py-3 rounded-xl border-2 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors ${validationErrors.customer_email ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-purple-500'}`}
                    placeholder="jane@example.com"
                  />
                  {validationErrors.customer_email && <p className="mt-1 text-sm text-red-500 error-message">{validationErrors.customer_email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instagram Handle</label>
                  <div className="relative">
                    <input
                      type="text"
                      name="instagram_handle"
                      value={formData.instagram_handle}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-3 rounded-xl border-2 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors ${validationErrors.instagram_handle ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-purple-500'}`}
                      placeholder="@username"
                    />
                  </div>
                  {validationErrors.instagram_handle && <p className="mt-1 text-sm text-red-500 error-message">{validationErrors.instagram_handle}</p>}
                  <p className="mt-1 text-xs text-gray-500">We use this to identify you and tag your look!</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests (Optional)</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors"
                    placeholder="Any specific preferences..."
                  />
                </div>
              </div>
            </div>

            {/* Right Column: Date & Time */}
            <div className="p-8 lg:p-10 bg-gray-50">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2" style={{ fontFamily: '"UnifrakturCook", cursive' }}>
                <span className="text-purple-600">2.</span> Date & Time
              </h2>

              <div className="mb-6">
                <Calendar
                  onChange={handleDateChange}
                  value={formData.booking_date}
                  className="w-full border-0 rounded-xl shadow-sm p-4 !font-sans"
                  minDate={new Date()}
                  tileClassName={({ date, view }) => {
                    if (view === 'month') {
                      const isSelected = date.toDateString() === new Date(formData.booking_date).toDateString();
                      return isSelected ? '!bg-purple-600 !text-white rounded-lg' : 'hover:bg-purple-50 rounded-lg';
                    }
                  }}
                />
                {validationErrors.booking_date && <p className="mt-2 text-sm text-red-500 text-center">{validationErrors.booking_date}</p>}
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Available Slots for {new Date(formData.booking_date).toLocaleDateString()}</h3>
                
                {slotsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  </div>
                ) : slotsError ? (
                  <div className="text-center py-8 text-red-500 bg-red-50 rounded-xl border border-red-100">
                    {slotsError}
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-white rounded-xl border border-gray-200">
                    No slots available for this date.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {availableSlots.map((slot, index) => {
                      const timeStr = slot.includes('T') 
                        ? slot.split('T')[1].substring(0, 5) 
                        : slot.substring(0, 5);
                      
                      const isSelected = formData.booking_time === timeStr;
                      
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleTimeSelect(slot)}
                          className={`
                            py-2 px-1 text-sm rounded-lg border transition-all duration-200
                            ${isSelected 
                              ? 'bg-purple-600 text-white border-purple-600 shadow-md transform scale-105' 
                              : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50'}
                          `}
                        >
                          {formatTimeDisplay(slot)}
                        </button>
                      );
                    })}
                  </div>
                )}
                {validationErrors.booking_time && <p className="mt-2 text-sm text-red-500 text-center">{validationErrors.booking_time}</p>}
              </div>
            </div>
          </div>

          {/* Footer / Submit */}
          <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500 text-center sm:text-left">
              By booking, you agree to our terms. <br/>
              Confirmation will be sent to your email.
            </p>
            
            <button
              type="submit"
              disabled={loading}
              className={`
                px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2
                ${loading ? 'opacity-70 cursor-wait' : 'hover:from-purple-700 hover:to-pink-700'}
              `}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <span>Confirm Booking</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default PublicBooking;
