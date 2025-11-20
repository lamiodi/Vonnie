import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { handleError, handleSuccess } from '../utils/errorHandler';
import { convertToNigeriaISOString } from '../utils/formatters';
import PaystackPayment from '../components/PaystackPayment';

const PublicBooking = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    booking_date: new Date(),
    booking_time: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    notes: ''
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(null);
  const [totalPrice, setTotalPrice] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [bookingResponse, setBookingResponse] = useState(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const hasNavigatedRef = useRef(false);

  const endpoints = {
    services: '/api/public/services',
    availableSlots: '/api/public/bookings/available-slots',
    createBooking: '/api/public/bookings'
  };



  // Service images mapping
  const serviceImages = {
    'Hair Styling': (
      <svg className="w-full h-32 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2M21 9V7L15 1H9V3H7V1H5V4H7V6H9V7C9 8.1 9.9 9 11 9H13C14.1 9 15 8.1 15 7V6H17V4H19V1H17V3H15V1L21 7V9M7.5 12C7.5 13.38 8.62 14.5 10 14.5S12.5 13.38 12.5 12H7.5M16.5 12C16.5 13.38 17.62 14.5 19 14.5S21.5 13.38 21.5 12H16.5M12 16C8.69 16 6 18.69 6 22H18C18 18.69 15.31 16 12 16Z"/>
      </svg>
    ),
    'Manicure': (
      <svg className="w-full h-32 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M12,4A1,1 0 0,0 11,5V11A1,1 0 0,0 12,12A1,1 0 0,0 13,11V5A1,1 0 0,0 12,4M7,14A2,2 0 0,1 9,16V22H15V16A2,2 0 0,1 17,14H7Z"/>
      </svg>
    ),
    'Facial Treatment': (
      <svg className="w-full h-32 text-green-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M10,10A1,1 0 0,1 11,11A1,1 0 0,1 10,12A1,1 0 0,1 9,11A1,1 0 0,1 10,10M14,10A1,1 0 0,1 15,11A1,1 0 0,1 14,12A1,1 0 0,1 13,11A1,1 0 0,1 14,10M12,14C13.11,14 14,14.45 14,15C14,15.55 13.11,16 12,16C10.89,16 10,15.55 10,15C10,14.45 10.89,14 12,14Z"/>
      </svg>
    ),
    'Massage': (
      <svg className="w-full h-32 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M7,9V15H9V9H7M11,9V15H13V9H11M15,9V15H17V9H15Z"/>
      </svg>
    ),
    'default': (
      <svg className="w-full h-32 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,6V18L18,12"/>
      </svg>
    )
  };

  useEffect(() => {
    console.log('PublicBooking component mounted');
    fetchServices();

    // Listen for payment success messages from Paystack popup
    const handleMessage = (event) => {
      const origin = event.origin || '';
      const raw = event.data;
      console.log('Message received:', raw);
      console.log('Event origin:', origin);
      console.log('Message type:', raw?.type);

      // Case 1: Our custom message posted from PaystackPayment onSuccess
      if (raw?.type === 'PAYMENT_SUCCESS') {
        console.log('Custom PAYMENT_SUCCESS message:', raw.bookingData);
        if (hasNavigatedRef.current) {
          console.log('Navigation already performed; ignoring duplicate message');
          return;
        }
        hasNavigatedRef.current = true;
        try {
          navigate('/booking-confirmation', { state: { bookingData: raw.bookingData } });
          console.log('Navigated via custom PAYMENT_SUCCESS');
        } catch (error) {
          console.error('Error navigating via custom message:', error);
        }
        return;
      }

      // Case 2: Native Paystack messages from https://checkout.paystack.com
      if (origin.includes('checkout.paystack.com')) {
        let dataObj = null;
        if (typeof raw === 'string') {
          try {
            dataObj = JSON.parse(raw);
          } catch (e) {
            // Non-JSON string like 'loaded:checkout' or 'loaded:transaction'
            dataObj = { event: raw };
          }
        } else if (typeof raw === 'object' && raw !== null) {
          dataObj = raw;
        }

        const isSuccess = !!(
          (dataObj && (dataObj.event === 'success' || dataObj.status === 'success')) ||
          (dataObj?.data && (dataObj.data.event === 'success' || dataObj.data.status === 'success'))
        );

        if (isSuccess) {
          console.log('Detected Paystack success message:', dataObj);
          if (hasNavigatedRef.current) {
            console.log('Navigation already performed; ignoring duplicate Paystack success');
            return;
          }
          hasNavigatedRef.current = true;
          try {
            // Use bookingResponse state instead of localStorage
            let bookingData = bookingResponse || {};
            bookingData.payment_status = 'completed';
            navigate('/booking-confirmation', { state: { bookingData } });
            console.log('Navigated via Paystack success message');
          } catch (error) {
            console.error('Error navigating via Paystack message:', error);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    console.log('Added message event listener');

    return () => {
      console.log('PublicBooking component unmounting');
      window.removeEventListener('message', handleMessage);
      console.log('Removed message event listener');
    };
  }, [navigate]);

  useEffect(() => {
    if (formData.booking_date && selectedServices.length > 0) {
      fetchAvailableSlots();
    }
  }, [formData.booking_date, selectedServices]);

  useEffect(() => {
    const total = selectedServices.reduce((sum, service) => sum + parseFloat(service.price || 0), 0);
    const duration = selectedServices.reduce((sum, service) => sum + parseInt(service.duration || 60), 0);
    setTotalPrice(total);
    setTotalDuration(duration);
  }, [selectedServices]);

  const fetchServices = async () => {
    try {
      const response = await axios.get(endpoints.services);
      setServices(response.data);
    } catch (error) {
      console.error('Error fetching services:', error);
      handleError(error, 'Failed to fetch services. Please try again.');
    }
  };

  const fetchAvailableSlots = async () => {
    setSlotsLoading(true);
    setSlotsError(null);

    try {
      const dateStr = new Date(formData.booking_date).toISOString().split('T')[0];
      const serviceIds = selectedServices.map(s => s.id);
      const url = `${endpoints.availableSlots}?date=${dateStr}&service_ids=${serviceIds.join(',')}`;
      const response = await axios.get(url);

      let slots = [];
      console.log('Available slots API response:', response.data);
      
      if (Array.isArray(response.data)) {
        slots = response.data.map(slot => {
          if (typeof slot === 'string') return slot;
          if (slot && typeof slot === 'object') {
            return slot.formatted_time || slot.time || slot.start_time || JSON.stringify(slot);
          }
          return '';
        }).filter(slot => slot !== '');
      } else if (response.data && typeof response.data === 'object') {
        if (response.data.available_slots && Array.isArray(response.data.available_slots)) {
          slots = response.data.available_slots;
        } else if (response.data.slots && Array.isArray(response.data.slots)) {
          slots = response.data.slots;
        } else if (response.data.times && Array.isArray(response.data.times)) {
          slots = response.data.times;
        }
      }
      
      console.log('Processed slots:', slots);

      setAvailableSlots(slots);
      if (slots.length === 0) {
        setSlotsError('No available time slots for this date. Please try another date.');
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
      const errorMessage = error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to fetch available time slots. Please try again.';
      handleError(error, errorMessage);
      setSlotsError(errorMessage);
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleServiceToggle = (service) => {
    setSelectedServices(prev => {
      const isSelected = prev.find(s => s.id === service.id);
      if (isSelected) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
    setFormData(prev => ({ ...prev, booking_time: '' }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleDateChange = (date) => {
    // Ensure date is always a Date object
    const dateObj = date instanceof Date ? date : new Date(date);
    setFormData(prev => ({
      ...prev,
      booking_date: dateObj,
      booking_time: ''
    }));
  };

  const validateStep4 = () => {
    const errors = {};
    
    if (!formData.customer_name?.trim()) {
      errors.customer_name = 'Full name is required';
    } else if (formData.customer_name.trim().length < 2) {
      errors.customer_name = 'Name must be at least 2 characters';
    }
    
    if (!formData.customer_email?.trim()) {
      errors.customer_email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customer_email)) {
      errors.customer_email = 'Please enter a valid email address';
    }
    
    if (!formData.customer_phone?.trim()) {
      errors.customer_phone = 'Phone number is required';
    } else if (!/^[\+]?[0-9][\d]{0,15}$/.test(formData.customer_phone.replace(/[\s\-\(\)]/g, ''))) {
      errors.customer_phone = 'Please enter a valid phone number';
    }
    
    if (!formData.booking_time?.trim()) {
      errors.booking_time = 'Please select a time slot for your booking';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateStep4()) {
      return;
    }
    
    setLoading(true);

    // Debug: Log current form data state
    console.log('Current formData before submission:', {
      booking_date: formData.booking_date,
      booking_date_type: typeof formData.booking_date,
      booking_time: formData.booking_time
    });

    try {
      const serviceIds = selectedServices.map(s => s.id);
      // Booking number is generated server-side, no need for client-side generation

      // Create proper ISO datetime string for scheduled_time
      // Ensure booking_date is a Date object before calling toISOString
      console.log('formData.booking_date type:', typeof formData.booking_date);
      console.log('formData.booking_date value:', formData.booking_date);
      console.log('formData.booking_time value:', formData.booking_time);
      
      const bookingDate = formData.booking_date instanceof Date ? formData.booking_date : new Date(formData.booking_date);
      console.log('bookingDate after conversion:', bookingDate);
      
      const dateOnly = bookingDate.toISOString().split('T')[0];
      console.log('dateOnly:', dateOnly);
      
      const timeWithSeconds = formData.booking_time.length === 5 ? `${formData.booking_time}:00` : formData.booking_time;
      console.log('timeWithSeconds:', timeWithSeconds);
      
      // Convert to Nigeria timezone ISO string for consistent datetime handling
      const dateTimeStr = convertToNigeriaISOString(`${dateOnly}T${timeWithSeconds}`);
      
      console.log('Generated dateTimeStr:', dateTimeStr);
      const bookingData = {
        service_ids: serviceIds,
        worker_id: null,
        scheduled_time: dateTimeStr,
        duration: totalDuration,
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        notes: formData.notes,
        total_amount: totalPrice,
        payment_status: 'pending',
        customer_type: 'pre_booked',

      };
      
      console.log('Sending booking data to backend:', JSON.stringify(bookingData, null, 2));

      const response = await axios.post(endpoints.createBooking, bookingData);
      setBookingResponse(response.data);
      console.log('Booking created successfully:', response.data);

      const bookingInfo = {
        customer_name: formData.customer_name,
        customer_email: formData.customer_email,
        customer_phone: formData.customer_phone,
        service_name: selectedServices.map(s => s.name).join(', '),
        booking_date: formData.booking_date,
        booking_time: formData.booking_time,
        duration: totalDuration,
        total_amount: totalPrice,
        status: 'scheduled',
        payment_status: 'pending',
        notes: formData.notes
      };
      // Use state instead of localStorage - server handles booking number generation
      setBookingResponse(bookingInfo);
      console.log('Saved booking data to state:', bookingInfo);

      setCurrentStep(5);
    } catch (error) {
      console.error('Error creating booking:', error);
      console.error('Full error response:', error.response?.data);
      console.error('Error object structure:', error.response?.data?.error);
      
      // Extract the actual error message from the nested error object
      let errorMessage = 'Error creating booking. Please try again.';
      if (error.response?.data?.error) {
        if (typeof error.response.data.error === 'string') {
          errorMessage = error.response.data.error;
        } else if (error.response.data.error.message) {
          errorMessage = error.response.data.error.message;
        } else if (error.response.data.error.error) {
          errorMessage = error.response.data.error.error;
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      handleError(error, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (result) => {
    // result may be a plain reference string or an object { reference, bookingData }
    const txRef = typeof result === 'string' ? result : result?.reference;
    console.log('Payment successful with reference:', txRef);
    setPaymentCompleted(true);

    // Use bookingResponse state instead of localStorage
    let bookingInfo;

    if (!bookingResponse) {
      console.log('No booking response available, creating fallback');
      bookingInfo = {
        booking_number: 'UNKNOWN',
        customer_name: formData.customer_name || 'Unknown Customer',
        customer_email: formData.customer_email || '',
        customer_phone: formData.customer_phone || '',
        service_name: selectedServices.map(s => s.name).join(', ') || 'Unknown Service',
        booking_date: formData.booking_date,
        booking_time: formData.booking_time,
        duration: totalDuration,
        total_amount: totalPrice,
        status: 'scheduled',
        payment_status: 'completed',
        notes: formData.notes || ''
      };
    } else {
      bookingInfo = bookingResponse;
    }

    // If Paystack component provided bookingData, prefer merging it
    if (result && typeof result === 'object' && result.bookingData) {
      bookingInfo = { ...bookingInfo, ...result.bookingData };
    }

    bookingInfo.payment_status = 'completed';
    console.log('Updated booking info with payment status:', bookingInfo);

    try {
      await axios.post('/api/public/payment/verify', { reference: txRef });
      console.log('Payment verification successful');
    } catch (verifyError) {
      console.error('Payment verification failed:', verifyError);
    }

    // Removed localStorage dependency - booking data is managed through state
    console.log('Payment completed, booking data managed through state');
    
    if (hasNavigatedRef.current) {
      console.log('Navigation already performed via message; skipping direct navigate');
      return;
    }
    hasNavigatedRef.current = true;
    console.log('About to navigate to booking-confirmation with state:', { bookingData: bookingInfo });
    navigate('/booking-confirmation', {
      state: { bookingData: bookingInfo }
    });
  };

const handlePaymentClose = () => {
    console.log('Payment cancelled or closed');
    handleError(null, 'Payment was cancelled. Your booking is pending payment.');

    // Use bookingResponse state instead of localStorage
    let bookingInfo;

    if (!bookingResponse) {
      console.log('No booking response available, creating fallback');
      bookingInfo = {
        booking_number: 'UNKNOWN',
        customer_name: formData.customer_name || 'Unknown Customer',
        customer_email: formData.customer_email || '',
        customer_phone: formData.customer_phone || '',
        service_name: selectedServices.map(s => s.name).join(', ') || 'Unknown Service',
        booking_date: formData.booking_date,
        booking_time: formData.booking_time,
        duration: totalDuration,
        total_amount: totalPrice,
        status: 'scheduled',
        payment_status: 'pending',
        notes: formData.notes || ''
      };
    } else {
      bookingInfo = bookingResponse;
    }

    // Removed localStorage dependency - booking data managed through state
    console.log('Payment cancelled, booking data managed through state');
    
    if (hasNavigatedRef.current) {
      console.log('Navigation already performed; skipping close navigation');
      return;
    }
    hasNavigatedRef.current = true;
    console.log('About to navigate to booking-confirmation with state:', { bookingData: bookingInfo });
    navigate('/booking-confirmation', {
      state: { bookingData: bookingInfo }
    });
  };

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const canProceedToStep2 = selectedServices.length > 0;
  const canProceedToStep3 = formData.booking_date;
  const canProceedToStep4 = formData.booking_time && !slotsLoading && !slotsError;

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  const formatTimeSlot = (timeString) => {
    try {
      // If it's already just a time (HH:mm format), return it as is
      if (timeString && timeString.length === 5 && timeString.includes(':')) {
        return timeString;
      }
      
      // If it's a full ISO timestamp, format it nicely
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return timeString;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Book Your Beauty Experience
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            Select your preferred services, date, and time
          </p>
          <p className="text-sm text-gray-500">
            Professional beauty services • Instant confirmation • Easy booking
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[
              { num: 1, icon: 'Select Services' },
              { num: 2, icon: 'Choose Date' },
              { num: 3, icon: 'Pick Time Slot' },
              { num: 4, icon: 'Your Details' },
              { num: 5, icon: 'Payment' }
            ].map(({ num, icon }) => (
              <div key={num} className="flex items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium transition-all duration-300 ${
                  currentStep >= num 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-110' 
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {currentStep > num ? '✓' : num}
                </div>
                {num < 5 && (
                  <div className={`w-16 h-1 mx-2 transition-all duration-300 ${
                    currentStep > num ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Labels */}
        <div className="flex justify-center mb-8">
          <div className="grid grid-cols-5 gap-6 text-center text-sm">
            <span className={currentStep >= 1 ? 'text-purple-600 font-semibold' : 'text-gray-500'}>
              Select Services
            </span>
            <span className={currentStep >= 2 ? 'text-purple-600 font-semibold' : 'text-gray-500'}>
              Choose Date
            </span>
            <span className={currentStep >= 3 ? 'text-purple-600 font-semibold' : 'text-gray-500'}>
              Pick Time Slot
            </span>
            <span className={currentStep >= 4 ? 'text-purple-600 font-semibold' : 'text-gray-500'}>
              Your Details
            </span>
            <span className={currentStep >= 5 ? 'text-purple-600 font-semibold' : 'text-gray-500'}>
              Payment
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Step 1: Service Selection */}
          {currentStep === 1 && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Select Your Services
                </h2>
                <p className="text-gray-600">Choose the beauty services you'd like to book</p>
              </div>

              {selectedServices.length > 0 && (
                <div className="mb-6 p-4 bg-purple-50 border-2 border-purple-200 rounded-xl flex items-center justify-center gap-3">
                  <span className="text-2xl">ℹ️</span>
                  <span className="text-purple-800 font-medium">
                    {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected • You can select multiple services
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map(service => {
                  const isSelected = selectedServices.find(s => s.id === service.id);
                  return (
                    <div
                      key={service.id}
                      className={`relative cursor-pointer rounded-2xl border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                        isSelected
                          ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                      onClick={() => handleServiceToggle(service)}
                    >
                      <div className="p-6">
                        <div className="mb-4 flex justify-center">
                          {serviceImages[service.name] || serviceImages.default}
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-800 mb-2 text-center">
                          {service.name}
                        </h3>
                        <p className="text-gray-600 text-sm mb-3 text-center min-h-[40px]">
                          {service.description || 'Professional beauty service'}
                        </p>
                        <div className="text-center space-y-1">
                          <div>
                            <span className="text-2xl font-bold text-purple-600">
                              ₦{parseFloat(service.price || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-gray-500 text-sm flex items-center justify-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                            {service.duration || 60} minutes
                          </div>
                        </div>
                        
                        {isSelected && (
                          <div className="absolute top-4 right-4 w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {selectedServices.length > 0 && (
                <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span>🛒</span>
                    Your Selected Services ({selectedServices.length})
                  </h3>
                  <div className="space-y-3">
                    {selectedServices.map((service, index) => (
                      <div key={service.id} className="flex justify-between items-center bg-white p-3 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </span>
                          <div>
                            <span className="text-gray-800 font-medium">{service.name}</span>
                            <span className="text-gray-500 text-sm ml-2">({service.duration || 60} min)</span>
                          </div>
                        </div>
                        <span className="font-semibold text-purple-600">₦{parseFloat(service.price || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t-2 border-purple-200 mt-4 pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-700 font-medium">Total Duration:</span>
                      <span className="font-bold text-gray-800">{formatDuration(totalDuration)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xl">
                      <span className="text-gray-800 font-bold">Total Price:</span>
                      <span className="font-bold text-purple-600">₦{totalPrice.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end mt-8">
                <button
                  onClick={nextStep}
                  disabled={!canProceedToStep2}
                  className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Continue to Date Selection →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Date Selection */}
          {currentStep === 2 && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Choose Your Date
                </h2>
                <p className="text-gray-600 mb-2">Select your preferred appointment date</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-md mx-auto">
                  <p className="text-sm text-blue-800 flex items-center gap-2">
                    <span>ℹ️</span>
                    <span>Professional staff will be assigned to you upon arrival</span>
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                    <span>📅</span>
                    Booking Date
                  </label>
                  <div className="flex justify-center">
                    <Calendar
                      onChange={handleDateChange}
                      value={formData.booking_date}
                      minDate={new Date()}
                      className="border-0 shadow-lg rounded-xl"
                    />
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 rounded-xl text-center">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">Selected: </span>
                      {formData.booking_date.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between mt-8">
                <button
                  onClick={prevStep}
                  className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 transition-all duration-300"
                >
                  ← Back to Services
                </button>
                <button
                  onClick={nextStep}
                  disabled={!canProceedToStep3}
                  className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Continue to Time Selection →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Time Selection */}
          {currentStep === 3 && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Select Your Time Slot
                </h2>
                <p className="text-gray-600 mb-2">
                  Choose your preferred appointment time
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-md mx-auto">
                  <p className="text-sm text-blue-800 flex items-center gap-2">
                    <span>ℹ️</span>
                    <span>Professional staff will be assigned to you upon arrival</span>
                  </p>
                </div>
              </div>
              
              {availableSlots.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {availableSlots.map(slot => (
                      <button
                        key={slot}
                        onClick={() => {
                          console.log('Selected time slot:', slot);
                          // Extract time part from ISO string if it's a full timestamp
                          let timePart = slot;
                          if (slot.includes('T')) {
                            // This is a full ISO timestamp, extract just the time
                            timePart = slot.split('T')[1].substring(0, 5); // Get HH:mm part
                          }
                          console.log('Extracted time part:', timePart);
                          setFormData(prev => ({ ...prev, booking_time: timePart }));
                        }}
                        className={`p-4 rounded-xl text-center font-medium transition-all duration-300 transform hover:scale-105 ${
                          formData.booking_time === (slot.includes('T') ? slot.split('T')[1].substring(0, 5) : slot)
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg ring-2 ring-purple-300 ring-opacity-50'
                            : 'bg-white text-gray-700 hover:bg-purple-50 hover:text-purple-700 border-2 border-gray-200 hover:border-purple-300 shadow-md'
                        }`}
                      >
                        <div className="text-lg font-semibold">{formatTimeSlot(slot)}</div>
                        <div className="text-xs text-gray-500 mt-1">Available</div>
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex justify-center">
                    <button
                      onClick={fetchAvailableSlots}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                      Refresh Times
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <svg className="w-10 h-10 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Loading available time slots...</h3>
                  <p className="text-sm text-gray-500">This may take a moment</p>
                  <div className="mt-4 w-48 h-2 bg-gray-200 rounded-full mx-auto overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full animate-pulse" style={{width: '60%'}}></div>
                  </div>
                </div>
              )}
              
              {formData.booking_time && (
                <div className="mt-6 p-4 bg-green-50 border-2 border-green-200 rounded-xl text-center">
                  <p className="text-green-800 font-medium">
                    Selected time: <span className="font-bold">{formatTimeSlot(formData.booking_time)}</span>
                  </p>
                </div>
              )}
              
              <div className="flex justify-between mt-8">
                <button
                  onClick={prevStep}
                  className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 transition-all duration-300"
                >
                  ← Back
                </button>
                <button
                  onClick={nextStep}
                  disabled={!canProceedToStep4}
                  className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Continue to Details →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Customer Details */}
          {currentStep === 4 && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Your Details
                </h2>
                <p className="text-gray-600">Please provide your contact information</p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <span>👤</span>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      name="customer_name"
                      value={formData.customer_name}
                      onChange={handleInputChange}
                      required
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                        validationErrors.customer_name 
                          ? 'border-red-500 bg-red-50' 
                          : 'border-gray-300 focus:border-purple-500'
                      }`}
                      placeholder="Enter your full name"
                    />
                    {validationErrors.customer_name && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.customer_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <span>📧</span>
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="customer_email"
                      value={formData.customer_email}
                      onChange={handleInputChange}
                      required
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                        validationErrors.customer_email 
                          ? 'border-red-500 bg-red-50' 
                          : 'border-gray-300 focus:border-purple-500'
                      }`}
                      placeholder="your.email@example.com"
                    />
                    {validationErrors.customer_email && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.customer_email}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <span>📱</span>
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      name="customer_phone"
                      value={formData.customer_phone}
                      onChange={handleInputChange}
                      required
                      className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all ${
                        validationErrors.customer_phone 
                          ? 'border-red-500 bg-red-50' 
                          : 'border-gray-300 focus:border-purple-500'
                      }`}
                      placeholder="+1234567890"
                    />
                    {validationErrors.customer_phone && (
                      <p className="text-red-500 text-sm mt-1">{validationErrors.customer_phone}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Your booking number will use your first name and last 3 digits (e.g., BK-SARAH-123)
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <span>📝</span>
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                      placeholder="Any special requests or preferences..."
                    />
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 mt-8 border-2 border-purple-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <span>📋</span>
                    Booking Summary
                  </h3>
                  <div className="space-y-3 bg-white rounded-xl p-4">
                    <div className="flex justify-between items-start">
                      <span className="text-gray-600 font-medium">Services:</span>
                      <div className="text-right">
                        {selectedServices.map((s, i) => (
                          <div key={s.id} className="text-gray-800">
                            {i + 1}. {s.name}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 font-medium">Date:</span>
                      <span className="font-medium text-gray-800">
                        {formData.booking_date.toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 font-medium">Time:</span>
                      <span className="font-medium text-gray-800">{formatTimeSlot(formData.booking_time)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 font-medium">Duration:</span>
                      <span className="font-medium text-gray-800">{formatDuration(totalDuration)}</span>
                    </div>
                    <div className="border-t-2 border-purple-200 pt-3 mt-3">
                      <div className="flex justify-between text-xl">
                        <span className="text-gray-800 font-bold">Total Amount:</span>
                        <span className="font-bold text-purple-600">₦{totalPrice.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 transition-all duration-300"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        Creating Booking...
                      </>
                    ) : (
                      <>
                        <span>✓</span>
                        Confirm Booking
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 5: Payment */}
          {currentStep === 5 && (
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Secure Payment
                </h2>
                <p className="text-gray-600">Complete your booking with Paystack</p>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 mb-8 border-2 border-purple-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span>📋</span>
                  Booking Summary
                </h3>
                <div className="space-y-3 bg-white rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <span className="text-gray-600 font-medium">Services:</span>
                    <div className="text-right">
                      {selectedServices.map((s, i) => (
                        <div key={s.id} className="text-gray-800">
                          {i + 1}. {s.name}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Date:</span>
                    <span className="font-medium text-gray-800">
                      {formData.booking_date.toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Time:</span>
                    <span className="font-medium text-gray-800">{formatTimeSlot(formData.booking_time)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Duration:</span>
                    <span className="font-medium text-gray-800">{formatDuration(totalDuration)}</span>
                  </div>

                  <div className="border-t-2 border-purple-200 pt-3 mt-3">
                    <div className="flex justify-between text-xl">
                      <span className="text-gray-800 font-bold">Total Amount:</span>
                      <span className="font-bold text-purple-600">₦{totalPrice.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span>💳</span>
                  Payment Method
                </h3>
                <div className="space-y-4">
                  <div className="border-2 border-purple-200 bg-purple-50 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">P</span>
                      </div>
                      <span className="font-semibold text-gray-800">Paystack (Secure Online Payment)</span>
                    </div>
                    <p className="text-gray-600 text-sm ml-11">
                      Pay securely with your card, bank transfer, or mobile money. Instant confirmation.
                    </p>
                  </div>
                </div>
              </div>

              {bookingResponse && (
                <div className="text-center">
                  <PaystackPayment
                    amount={totalPrice}
                    email={formData.customer_email}
                    bookingNumber={bookingResponse?.booking_number}
                    onSuccess={handlePaymentSuccess}
                    onClose={handlePaymentClose}
                    buttonText={`Pay ₦${totalPrice.toLocaleString()} Now`}
                    buttonClass="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl text-lg"
                  />
                  

                </div>
              )}

              <div className="flex justify-between mt-8">
                <button
                  onClick={prevStep}
                  className="px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 transition-all duration-300"
                >
                  ← Back
                </button>
                <div className="text-sm text-gray-500 flex items-center gap-2">
                  <span>🔒</span>
                  <span>Secured by Paystack</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-sm text-gray-600 space-y-2">
          <p>Your information is secure and will only be used for booking purposes</p>
          <p>You'll receive a confirmation email with your unique booking number</p>
          <p>Need help? Contact us at support@beautyapp.com</p>
        </div>
      </div>
    </div>
  );
};

export default PublicBooking;