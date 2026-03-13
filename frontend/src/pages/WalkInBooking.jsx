import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { handleError, handleSuccess } from '../utils/errorHandler';
import '@fontsource/patrick-hand';
import '@fontsource/unifrakturcook';

const WalkInBooking = () => {
  const navigate = useNavigate();

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
  const [showOptionalFields, setShowOptionalFields] = useState(false);
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
    return () => {
      if (slotsControllerRef.current) {
        slotsControllerRef.current.abort();
      }
    };
  }, [formData.booking_date]);

  const fetchAvailableSlots = async () => {
    if (slotsControllerRef.current) {
      try { slotsControllerRef.current.abort(); } catch (e) { }
    }

    setSlotsLoading(true);
    setSlotsError(null);
    setFormData(prev => ({ ...prev, booking_time: '' })); // Reset time selection

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller) {
      slotsControllerRef.current = controller;
    }

    try {
      const dateStr = formData.booking_date.toLocaleDateString('en-CA');
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
      setSlotsLoading(false);
    } catch (error) {
      if (axios.isCancel(error)) return;
      console.error('Error fetching slots:', error);
      setSlotsError('Could not load available times. Please try another date.');
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
      booking_date: date
    }));
  };

  const handleTimeSelect = (slot) => {
    setFormData(prev => ({
      ...prev,
      booking_time: slot.time
    }));
    if (validationErrors.booking_time) {
      setValidationErrors(prev => ({ ...prev, booking_time: null }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.customer_name.trim()) errors.customer_name = 'Name is required';
    if (!formData.customer_phone.trim()) {
      errors.customer_phone = 'Phone number is required';
    } else if (!/^(0[789][01]\d{8}|(?:\+234|234)\d{10})$/.test(formData.customer_phone.trim())) {
      errors.customer_phone = 'Please enter a valid Nigerian phone number';
    }
    if (!formData.booking_date) errors.booking_date = 'Date is required';
    if (!formData.booking_time) errors.booking_time = 'Time is required';

    // Email is now optional, validate only if provided
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.customer_email && formData.customer_email.trim() && !emailRegex.test(formData.customer_email)) {
      errors.customer_email = 'Please enter a valid email address';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      handleError(null, 'Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      // Prepare booking payload
      const payload = {
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_email: formData.customer_email || undefined,
        instagram_handle: formData.instagram_handle || undefined,
        scheduled_time: `${formData.booking_date.toLocaleDateString('en-CA')}T${formData.booking_time}:00`,
        notes: formData.notes,
        customer_type: 'walk_in',
        service_ids: [] // Walk-in doesn't select services upfront
      };

      const response = await axios.post(endpoints.createBooking, payload);

      handleSuccess('Booking created successfully!');

      // Navigate to confirmation page
      navigate('/booking-confirmation', {
        state: {
          bookingData: response.data.data || response.data
        }
      });

    } catch (error) {
      console.error('Booking error:', error);
      let errorMessage = 'Failed to create booking. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      handleError(error, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get day class for calendar
  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) return 'opacity-50 cursor-not-allowed';
      if (date.getDay() === 0) return 'text-red-500'; // Sunday styling
    }
    return '';
  };

  return (
    <div className="min-h-screen p-6" style={{ backgroundColor: '#f0f1f2', fontFamily: '"Patrick Hand", cursive' }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Patrick+Hand&family=UnifrakturCook:wght@700&display=swap');
          
          /* Custom Calendar Styles */
          .react-calendar {
            width: 100%;
            border: none;
            background: white;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          }
        `}
      </style>

      <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border-4 border-gray-900">
        <div className="grid grid-cols-1 lg:grid-cols-2">

          {/* Left Panel - Branding & Info */}
          <div className="bg-gray-900 p-8 text-white relative overflow-hidden flex flex-col justify-between min-h-[400px] lg:min-h-full">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '30px 30px' }}>
            </div>

            <div className="relative z-10">
              <div className="mb-6">
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center text-gray-400 hover:text-white transition-colors font-sans text-sm font-bold uppercase tracking-wider"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Home
                </button>
              </div>

              <h1 className="text-5xl mb-4" style={{ fontFamily: '"UnifrakturCook", cursive', letterSpacing: '2px' }}>
                Walk-In<br />Booking
              </h1>
              <div className="w-20 h-1 bg-white mb-6"></div>
              <p className="text-xl opacity-90 font-light">
                Quick booking for walk-in customers.
              </p>
            </div>

            <div className="relative z-10 mt-12">
              <div className="space-y-4 font-sans">
                <div className="flex items-center">
                  <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center mr-3 border border-gray-700">1</span>
                  <p>Enter Customer Details</p>
                </div>
                <div className="flex items-center">
                  <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center mr-3 border border-gray-700">2</span>
                  <p>Select Date & Time</p>
                </div>
                <div className="flex items-center">
                  <span className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center mr-3 border border-gray-700">3</span>
                  <p>Confirm Booking</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Booking Form */}
          <div className="p-8 lg:p-12 bg-white">
            <form onSubmit={handleSubmit} className="space-y-8">

              {/* Customer Details */}
              <section>
                <h3 className="text-2xl font-bold mb-6 flex items-center text-gray-800" style={{ fontFamily: '"UnifrakturCook", cursive' }}>
                  <span className="w-8 h-8 rounded-full bg-black text-white text-sm flex items-center justify-center mr-3 font-sans">1</span>
                  Customer Info
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Name *</label>
                    <input
                      type="text"
                      name="customer_name"
                      value={formData.customer_name}
                      onChange={handleInputChange}
                      className={`w-full p-3 bg-gray-50 border ${validationErrors.customer_name ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all`}
                      placeholder="Jane Doe"
                    />
                    {validationErrors.customer_name && <p className="text-red-500 text-xs mt-1">{validationErrors.customer_name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone *</label>
                    <input
                      type="tel"
                      name="customer_phone"
                      value={formData.customer_phone}
                      onChange={handleInputChange}
                      className={`w-full p-3 bg-gray-50 border ${validationErrors.customer_phone ? 'border-red-500' : 'border-gray-200'} rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all`}
                      placeholder="08012345678"
                    />
                    {validationErrors.customer_phone && <p className="text-red-500 text-xs mt-1">{validationErrors.customer_phone}</p>}
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <button
                      type="button"
                      onClick={() => setShowOptionalFields(!showOptionalFields)}
                      className="text-sm text-gray-500 underline hover:text-black transition-colors flex items-center"
                    >
                      {showOptionalFields ? 'Hide Optional Details' : 'Add Email or Instagram (Optional)'}
                      <svg className={`w-4 h-4 ml-1 transform transition-transform ${showOptionalFields ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {showOptionalFields && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email <span className="font-normal text-gray-400">(Optional)</span></label>
                        <input
                          type="email"
                          name="customer_email"
                          value={formData.customer_email}
                          onChange={handleInputChange}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                          placeholder="jane@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Instagram <span className="font-normal text-gray-400">(Optional)</span></label>
                        <input
                          type="text"
                          name="instagram_handle"
                          value={formData.instagram_handle}
                          onChange={handleInputChange}
                          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                          placeholder="@janedoe"
                        />
                      </div>
                    </>
                  )}
                </div>
              </section>

              {/* Date & Time Selection */}
              <section>
                <h3 className="text-2xl font-bold mb-6 flex items-center text-gray-800" style={{ fontFamily: '"UnifrakturCook", cursive' }}>
                  <span className="w-8 h-8 rounded-full bg-black text-white text-sm flex items-center justify-center mr-3 font-sans">2</span>
                  Date & Time
                </h3>

                <div className="mb-6 font-sans">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Date *</label>
                  <div className="border border-gray-200 rounded-xl overflow-hidden p-4 bg-gray-50">
                    <Calendar
                      onChange={handleDateChange}
                      value={formData.booking_date}
                      minDate={new Date()}
                      tileClassName={tileClassName}
                      className="w-full border-none bg-transparent"
                    />
                  </div>
                </div>

                <div className="font-sans">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Time *</label>

                  {slotsLoading ? (
                    <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-lg">
                      <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2"></div>
                      <p>Loading slots...</p>
                    </div>
                  ) : slotsError ? (
                    <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                      {slotsError}
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="p-4 bg-yellow-50 text-yellow-700 rounded-lg text-sm border border-yellow-100">
                      No available slots for this date. Please select another day.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {availableSlots.map((slot, index) => {
                        // Ensure slot is an object and has required properties
                        let time = typeof slot === 'string' ? slot : slot?.time;
                        let label = typeof slot === 'string' ? slot : slot?.label;
                        
                        // Fallback if label is missing or invalid
                        if (!label || typeof label === 'object') {
                          label = time;
                        }

                        if (!time) return null;

                        return (
                          <button
                            key={`${time}-${index}`}
                            type="button"
                            onClick={() => handleTimeSelect(typeof slot === 'string' ? { time: slot, label: slot } : slot)}
                            className={`
                              py-2 px-3 text-sm rounded-lg border transition-all duration-200
                              ${formData.booking_time === time 
                                ? 'bg-black text-white border-black shadow-lg transform scale-105' 
                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                              }
                            `}
                          >
                            {String(label)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {validationErrors.booking_time && <p className="text-red-500 text-xs mt-1">{validationErrors.booking_time}</p>}
                </div>
              </section>

              {/* Notes */}
              <section>
                <div className="font-sans">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                    placeholder="Any special requests?"
                  />
                </div>
              </section>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition-all transform hover:-translate-y-1 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed font-sans uppercase tracking-widest text-lg"
              >
                {loading ? 'Creating Booking...' : 'Confirm Booking'}
              </button>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalkInBooking;