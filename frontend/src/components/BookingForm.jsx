// Fixed BookingForm.jsx (added validation for fields, fixed customer_type to 'walk-in', improved accessibility)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { handleError, handleSuccess } from '../utils/errorHandler';

const BookingForm = ({ booking, onSubmit, onCancel, endpoints = {}, isWalkIn = false, bookings = [] }) => {
  const {
    services: servicesEndpoint = '/api/services',
    workers: workersEndpoint = '/api/workers',
    availableSlots: availableSlotsEndpoint = '/api/bookings/available-slots',
    createBooking: createBookingEndpoint = '/api/bookings',
    updateBooking: updateBookingEndpoint = '/api/bookings'
  } = endpoints;
  const [services, setServices] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [formData, setFormData] = useState({
    service_ids: [],
    workers: [], // Add workers array for multi-worker support
    worker_id: '',
    booking_date: new Date(),
    booking_time: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    notes: ''
  });
  const [isWalkInMode, setIsWalkInMode] = useState(isWalkIn);
  const [loading, setLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  useEffect(() => {
    fetchServices();
    fetchWorkers();
   
    // If booking prop is provided, populate form for editing
    if (booking) {
      setIsEditing(true);
      setPaymentStatus(booking.payment_status || 'pending');
     
      // Parse the scheduled_time to extract date and time
      const scheduledDate = new Date(booking.scheduled_time);
      const timeString = scheduledDate.toTimeString().slice(0, 5); // HH:MM format
     
      setFormData({
        service_ids: booking.service_ids || (booking.service_id ? [booking.service_id] : []),
        workers: booking.workers || (booking.worker_id ? [{ worker_id: booking.worker_id }] : []),
        worker_id: booking.worker_id || (booking.workers?.[0]?.worker_id || ''),
        booking_date: scheduledDate,
        booking_time: timeString,
        customer_name: booking.customer_name,
        customer_email: booking.customer_email,
        customer_phone: booking.customer_phone,
        notes: booking.notes || ''
      });
    }
  }, [booking]);
  useEffect(() => {
    const hasWorkers = Array.isArray(formData.workers) && formData.workers.length > 0;
    const hasServices = Array.isArray(formData.service_ids) && formData.service_ids.length > 0;
    if (hasWorkers && formData.booking_date && hasServices) {
      fetchAvailableSlots();
    }
  }, [formData.workers, formData.booking_date, formData.service_ids]);
  const fetchServices = async () => {
    try {
      const response = await axios.get(servicesEndpoint);
      setServices(response.data);
    } catch (error) {
      handleError('Failed to load services', error);
    }
  };
  const fetchWorkers = async () => {
    try {
      const response = await axios.get(workersEndpoint);
      setWorkers(response.data);
    } catch (error) {
      handleError('Failed to load workers', error);
    }
  };
  const fetchAvailableSlots = async () => {
    try {
      const dateStr = formData.booking_date.toISOString().split('T')[0];
      const workerIds = formData.workers.map(w => w.worker_id).join(',');
      const url = `${availableSlotsEndpoint}?worker_id=${workerIds}&date=${dateStr}&service_ids=${formData.service_ids.join(',')}`;
      const response = await axios.get(url);
      const data = Array.isArray(response.data)
        ? response.data.map(s => s.formatted_time || s)
        : [];
      setAvailableSlots(data);
    } catch (error) {
      handleError('Failed to load available time slots', error);
    }
  };
  const validateField = (name, value) => {
    let error = '';
   
    switch (name) {
      case 'customer_name':
        if (!value.trim()) {
          error = 'Customer name is required';
        } else if (value.trim().length < 2) {
          error = 'Name must be at least 2 characters long';
        } else if (value.trim().length > 50) {
          error = 'Name must not exceed 50 characters';
        } else if (!/^[a-zA-Z\s.'-]+$/.test(value.trim())) {
          error = 'Name can only contain letters, spaces, periods, apostrophes, and hyphens';
        }
        break;
       
      case 'customer_email':
        if (!value.trim()) {
          error = 'Email address is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          error = 'Please enter a valid email address';
        } else if (value.trim().length > 100) {
          error = 'Email must not exceed 100 characters';
        }
        break;
       
      case 'customer_phone':
        if (!value.trim()) {
          error = 'Phone number is required';
        } else if (!/^\+?(234|0)?[789]\d{9}$/.test(value.trim().replace(/[\s-]/g, ''))) {
          error = 'Please enter a valid Nigerian phone number (e.g., 08012345678 or +2348012345678)';
        }
        break;
       
      case 'service_ids':
        if (!value || value.length === 0) {
          error = 'Please select at least one service';
        }
        break;
       
      case 'booking_time':
        if (!isWalkInMode && !value) {
          error = 'Please select a time slot';
        }
        break;
       
      case 'worker_id':
        if (!isWalkInMode && (!value || value.length === 0)) {
          error = 'Please select at least one worker';
        }
        break;
       
      default:
        break;
    }
   
    return error;
  };
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
   
    // Clear error for this field when user starts typing
    if (touched[name] && errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
   
    const error = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };
  const handleDateChange = (date) => {
    setFormData(prev => ({
      ...prev,
      booking_date: date,
      booking_time: '' // Reset time when date changes
    }));
  };
  const handleServiceSelection = (serviceId) => {
    setFormData(prev => {
      const currentServices = prev.service_ids || [];
      const isSelected = currentServices.includes(serviceId);
     
      if (isSelected) {
        return {
          ...prev,
          service_ids: currentServices.filter(id => id !== serviceId)
        };
      } else {
        return {
          ...prev,
          service_ids: [...currentServices, serviceId]
        };
      }
    });
  };
  const handleWorkerSelection = (workerId) => {
    setFormData(prev => {
      const currentWorkers = prev.workers || [];
      const isSelected = currentWorkers.some(w => w.worker_id === workerId);
     
      if (isSelected) {
        // Remove worker if already selected
        const updatedWorkers = currentWorkers.filter(w => w.worker_id !== workerId);
        return {
          ...prev,
          workers: updatedWorkers,
          worker_id: updatedWorkers.length > 0 ? updatedWorkers[0].worker_id : '' // Update primary worker
        };
      } else {
        // Add worker (no role needed)
        const updatedWorkers = [...currentWorkers, { worker_id: workerId }];
        return {
          ...prev,
          workers: updatedWorkers,
          worker_id: updatedWorkers.length > 0 ? updatedWorkers[0].worker_id : '' // Set primary worker
        };
      }
    });
  };
  const validateForm = () => {
    const newErrors = {};
   
    // Validate all fields
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key]);
      if (error) {
        newErrors[key] = error;
      }
    });
   
    // Additional date validation for non-walk-in bookings
    if (!isWalkInMode) {
      const selectedDate = new Date(formData.booking_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
     
      if (selectedDate < today) {
        newErrors.booking_date = 'Booking date cannot be in the past';
      }
     
      // Check if selected date is too far in future (e.g., more than 6 months)
      const maxFutureDate = new Date();
      maxFutureDate.setMonth(maxFutureDate.getMonth() + 6);
      if (selectedDate > maxFutureDate) {
        newErrors.booking_date = 'Booking date cannot be more than 6 months in advance';
      }
    }
   
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Removed frontend booking number generation - now handled server-side
  // This prevents conflicts and removes localStorage dependency

  const handleSubmit = async (e) => {
    e.preventDefault();
   
    // Validate form before submission
    if (!validateForm()) {
      // Mark all fields as touched to show validation errors
      const allTouched = {};
      Object.keys(formData).forEach(key => {
        allTouched[key] = true;
      });
      setTouched(allTouched);
      return;
    }
   
    setLoading(true);
    try {
      let payload;
     
      if (isWalkInMode) {
        // For walk-in customers, use current date/time
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().slice(0, 8); // HH:MM:SS format
        
        payload = {
          ...formData,
          service_ids: formData.service_ids, // Send array of service IDs
          service_id: formData.service_ids[0], // Keep for backward compatibility
          scheduled_time: `${dateStr}T${timeStr}`,
          booking_date: dateStr,
          booking_time: timeStr.slice(0, 5), // HH:MM format
          notes: formData.notes || 'Walk-in customer',
          customer_type: 'walk_in'
          // booking_number removed - now generated server-side
        };
      } else {
        // For regular bookings, use selected date/time
        const bookingData = {
          ...formData,
          service_ids: formData.service_ids, // Send array of service IDs
          service_id: formData.service_ids[0], // Keep for backward compatibility
          booking_date: formData.booking_date.toISOString().split('T')[0]
        };
        
        // Compose scheduled_time from selected date and time if available
        const dateStr = formData.booking_date.toISOString().split('T')[0];
        const timeStr = formData.booking_time.length === 5 ? `${formData.booking_time}:00` : formData.booking_time;
        payload = {
          ...bookingData,
          scheduled_time: `${dateStr}T${timeStr}`,
          customer_type: 'pre_booked'
          // booking_number removed - now generated server-side
        };
      }
      let response;
      if (isEditing && booking) {
        // Update existing booking
        response = await axios.put(`${updateBookingEndpoint}/${booking.id}`, payload);
       
        // Assign multiple workers if provided (simplified - no roles)
        if (formData.workers && formData.workers.length > 0) {
          try {
            const workers = formData.workers.map(w => ({ worker_id: w.worker_id }));
            await axios.post(`/api/bookings/${booking.id}/assign-workers`, {
              workers: workers
            });
          } catch (workerError) {
            console.error('Error assigning workers:', workerError);
            // Don't fail the booking update if worker assignment fails
          }
        }
       
        handleSuccess('Booking updated successfully!');
      } else {
        // Create new booking
        response = await axios.post(createBookingEndpoint, payload);
       
        // Assign multiple workers if provided (simplified - no roles)
        if (formData.workers && formData.workers.length > 0) {
          try {
            const workers = formData.workers.map(w => ({ worker_id: w.worker_id }));
            await axios.post(`/api/bookings/${response.data.id}/assign-workers`, {
              workers: workers
            });
          } catch (workerError) {
            console.error('Error assigning workers:', workerError);
            // Don't fail the booking creation if worker assignment fails
          }
        }
       
        handleSuccess('Booking created successfully!');
      }
     
      if (onSubmit) {
        onSubmit(response.data);
      }
      // Reset form only for new bookings
      if (!isEditing) {
        setFormData({
          service_ids: [],
          workers: [],
          worker_id: '',
          booking_date: new Date(),
          booking_time: '',
          customer_name: '',
          customer_email: '',
          customer_phone: '',
          notes: ''
        });
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Error saving booking. Please try again.';
      handleError(message, error);
    } finally {
      setLoading(false);
    }
  };
  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md" role="main">
      <h2 className="text-2xl font-bold mb-6 text-gray-800" id="booking-form-title">
        {isEditing ? 'Edit Booking' : 'New Walk-in Customer'}
      </h2>
     
      {/* Payment Status Display for Editing Mode */}
      {isEditing && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Payment Status:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(paymentStatus)}`}>
              {paymentStatus?.toUpperCase() || 'PENDING'}
            </span>
          </div>
          {booking?.booking_number && (
            <div className="mt-2 text-sm text-gray-600">
              Booking #: {booking.booking_number}
            </div>
          )}
        </div>
      )}
     
      <form onSubmit={handleSubmit} className="space-y-6" role="form" aria-labelledby="booking-form-title">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer Information */}
          <div>
            <label htmlFor="customer-name" className="block text-sm font-medium text-gray-700 mb-2">
              Customer Name *
            </label>
            <input
              id="customer-name"
              type="text"
              name="customer_name"
              value={formData.customer_name}
              onChange={handleInputChange}
              onBlur={handleBlur}
              required
              aria-required="true"
              aria-invalid={touched.customer_name && errors.customer_name ? 'true' : 'false'}
              aria-describedby={touched.customer_name && errors.customer_name ? 'customer-name-error' : undefined}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                touched.customer_name && errors.customer_name
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {touched.customer_name && errors.customer_name && (
              <p id="customer-name-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.customer_name}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="customer-email" className="block text-sm font-medium text-gray-700 mb-2">
              Customer Email *
            </label>
            <input
              id="customer-email"
              type="email"
              name="customer_email"
              value={formData.customer_email}
              onChange={handleInputChange}
              onBlur={handleBlur}
              required
              aria-required="true"
              aria-invalid={touched.customer_email && errors.customer_email ? 'true' : 'false'}
              aria-describedby={touched.customer_email && errors.customer_email ? 'customer-email-error' : undefined}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                touched.customer_email && errors.customer_email
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {touched.customer_email && errors.customer_email && (
              <p id="customer-email-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.customer_email}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="customer-phone" className="block text-sm font-medium text-gray-700 mb-2">
              Customer Phone *
            </label>
            <input
              id="customer-phone"
              type="tel"
              name="customer_phone"
              value={formData.customer_phone}
              onChange={handleInputChange}
              onBlur={handleBlur}
              required
              aria-required="true"
              aria-invalid={touched.customer_phone && errors.customer_phone ? 'true' : 'false'}
              aria-describedby={touched.customer_phone && errors.customer_phone ? 'customer-phone-error' : undefined}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                touched.customer_phone && errors.customer_phone
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-blue-500'
              }`}
            />
            {touched.customer_phone && errors.customer_phone && (
              <p id="customer-phone-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.customer_phone}
              </p>
            )}
          </div>
          {/* Service Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Services *
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
              {services.map(service => (
                <div
                  key={service.id}
                  onClick={() => handleServiceSelection(service.id)}
                  className={`p-3 rounded-md border cursor-pointer transition-all ${
                    formData.service_ids.includes(service.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{service.name}</div>
                      <div className="text-sm text-gray-600">
                        {service.duration} min • ₦{service.price}
                      </div>
                    </div>
                    {formData.service_ids.includes(service.id) && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Selected
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {touched.service_ids && errors.service_ids && (
              <p id="service-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.service_ids}
              </p>
            )}
          </div>
          {/* Worker Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Workers *
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-2">
              {workers.map(worker => {
                const isSelected = formData.workers.some(w => w.worker_id === worker.id);
                const statusColor = {
                  'available': 'bg-green-100 text-green-800',
                  'busy': 'bg-red-100 text-red-800',
                  'offline': 'bg-gray-100 text-gray-800'
                }[worker.current_status] || 'bg-gray-100 text-gray-800';
                
                return (
                  <div
                    key={worker.id}
                    onClick={() => handleWorkerSelection(worker.id)}
                    className={`p-3 rounded-md border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{worker.name}</div>
                        <div className="text-sm text-gray-600">{worker.role}</div>
                        {worker.specialty && (
                          <div className="text-xs text-purple-600 font-medium mt-1">
                            🎯 {worker.specialty}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                          {worker.current_status || 'available'}
                        </span>
                        {isSelected && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {touched.workers && errors.workers && (
              <p id="worker-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.workers}
              </p>
            )}
          </div>
        </div>
        {/* Date Selection - Hidden for Walk-ins */}
        {!isWalkInMode && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" id="date-label">
              Booking Date *
            </label>
            <div role="group" aria-labelledby="date-label" aria-describedby="date-description">
              <span id="date-description" className="sr-only">Select a date for your booking. Use arrow keys to navigate the calendar.</span>
              <Calendar
                onChange={handleDateChange}
                value={formData.booking_date}
                minDate={new Date()}
                className="mx-auto"
                aria-label="Select booking date"
              />
            </div>
          </div>
        )}
        {/* Time Selection - Hidden for Walk-ins */}
        {!isWalkInMode && availableSlots.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" id="time-slots-label">
              Available Time Slots *
            </label>
            <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="time-slots-label" aria-describedby="time-slots-description">
              <span id="time-slots-description" className="sr-only">Select an available time slot for your booking</span>
              {availableSlots.map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, booking_time: slot }))}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    formData.booking_time === slot
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  aria-pressed={formData.booking_time === slot}
                  aria-label={`Select time slot ${slot}`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Notes */}
        <div>
          <label htmlFor="booking-notes" className="block text-sm font-medium text-gray-700 mb-2">
            Additional Notes
          </label>
          <textarea
            id="booking-notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Any special requests or notes..."
            aria-describedby="notes-description"
          />
          <span id="notes-description" className="sr-only">Optional field for any special requests or additional information</span>
        </div>
        {/* Form Buttons */}
        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={loading || (!isWalkInMode && !formData.booking_time)}
            className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-describedby="submit-status"
          >
            {loading ? (isEditing ? 'Updating...' : 'Adding...') :
             (isEditing ? 'Update Booking' : 'Add Walk-in Customer')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
        <div id="submit-status" className="sr-only" role="status" aria-live="polite">
          {loading ? (isEditing ? 'Updating booking' : 'Processing your booking request') : 'Ready to save booking'}
        </div>
      </form>
    </div>
  );
};
export default BookingForm;