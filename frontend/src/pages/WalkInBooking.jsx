import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleError, handleSuccess } from '../utils/errorHandler';
import { apiGet, apiPost, API_ENDPOINTS } from '../utils/api';
import { createNigeriaISOString } from '../utils/formatters';
import { isValidCustomerType } from '../utils/bookingUtils';

const WalkInBooking = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [busyWorkers, setBusyWorkers] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    notes: ''
  });

  // Fetch services and workers on component mount
  useEffect(() => {
    fetchServices();
    fetchWorkers();
    fetchBusyWorkers();
  }, []);

  const fetchServices = async () => {
    try {
      const data = await apiGet(API_ENDPOINTS.SERVICES);
      setServices(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      console.error('Error fetching services:', error);
      setServices([]);
    }
  };

  const fetchWorkers = async () => {
    try {
      const data = await apiGet(API_ENDPOINTS.WORKERS);
      setWorkers(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      try {
        const fallback = await apiGet(API_ENDPOINTS.PUBLIC_WORKERS);
        setWorkers(Array.isArray(fallback) ? fallback : (fallback.data || []));
      } catch (fallbackError) {
        console.error('Error fetching workers:', fallbackError);
        setWorkers([]);
      }
    }
  };

  const fetchBusyWorkers = async () => {
    try {
      // Fetch workers who are currently busy with other bookings
      const today = new Date().toISOString().split('T')[0];
      const data = await apiGet(`/api/public/workers/busy-today?date=${today}`);
      setBusyWorkers(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      console.error('Error fetching busy workers:', error);
      setBusyWorkers([]);
    }
  };

  const handleServiceToggle = (serviceId) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleWorkerToggle = (workerId) => {
    setSelectedWorkers(prev => 
      prev.includes(workerId) 
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Calculate total price based on selected services
  const calculateTotalPrice = () => {
    return selectedServices.reduce((total, serviceId) => {
      const service = services.find(s => s.id === serviceId);
      return total + (service ? parseFloat(service.price) : 0);
    }, 0);
  };

  // Calculate total duration based on selected services
  const calculateTotalDuration = () => {
    return selectedServices.reduce((total, serviceId) => {
      const service = services.find(s => s.id === serviceId);
      return total + (service ? parseInt(service.duration) : 0);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.customer_name.trim()) {
      handleError(null, 'Customer name is required');
      return;
    }
    
    if (!formData.customer_phone.trim()) {
      handleError(null, 'Customer phone number is required');
      return;
    }
    
    // Basic phone validation (Nigerian format)
    const phoneRegex = /^[0-9\+\-\s\(\)]{10,15}$/;
    if (!phoneRegex.test(formData.customer_phone.trim())) {
      handleError(null, 'Please enter a valid phone number');
      return;
    }

    // Customer type validation
    const customerType = 'walk_in';
    if (!isValidCustomerType(customerType)) {
      handleError(null, 'Invalid customer type. Allowed: walk_in or pre_booked');
      return;
    }
    
    setLoading(true);

    try {
      // Validate worker availability before creating booking
      if (selectedWorkers.length > 0) {
        const unavailableWorkers = selectedWorkers.filter(workerId => 
          busyWorkers.some(busyWorker => busyWorker.worker_id === workerId)
        );
        
        if (unavailableWorkers.length > 0) {
          const unavailableNames = unavailableWorkers.map(workerId => {
            const worker = workers.find(w => w.id === workerId);
            return worker ? worker.name : 'Unknown Worker';
          }).join(', ');
          
          handleError(null, `The following workers are currently busy: ${unavailableNames}. Please select available workers.`);
          setLoading(false);
          return;
        }
      }
      // Prepare booking data
      const bookingData = {
        customer_name: formData.customer_name.trim(),
        customer_phone: formData.customer_phone.trim(),
        customer_email: formData.customer_email?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
        customer_type: customerType,
        scheduled_time: createNigeriaISOString(), // Current time for walk-in (Nigeria timezone)
        status: 'scheduled' // Explicitly set status
      };

      // Add services if selected
      if (selectedServices.length > 0) {
        bookingData.service_ids = selectedServices;
      }

      // Add worker_ids to booking data for direct assignment
      if (selectedWorkers.length > 0) {
        bookingData.worker_ids = selectedWorkers;
      }
      
      // Create the booking with worker assignment
      const response = await apiPost('/api/public/walk-in', bookingData);
      
      // Show success message with booking details
      const bookingNumber = response.booking_number || response.data?.booking_number || response.id;
      handleSuccess(`Walk-in booking created successfully! Booking #${bookingNumber}`);
      
      // Delay navigation slightly to allow user to see the success message
      setTimeout(() => {
        // Navigate to booking management or confirmation page
        navigate('/bookings', {
          state: {
            message: 'Walk-in booking created successfully!',
            bookingNumber: bookingNumber
          }
        });
      }, 2000);
      
    } catch (error) {
      console.error('Error creating walk-in booking:', error);
      
      // Enhanced error handling
      let errorMessage = 'Error creating walk-in booking. Please try again.';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      handleError(error, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
            Walk-In Booking
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            Quick booking for walk-in customers
          </p>
          <p className="text-sm text-gray-500">
            Optional service selection • Assign one or multiple workers
          </p>
        </div>

        {/* Booking Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Name */}
            <div>
              <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name *
              </label>
              <input
                type="text"
                id="customer_name"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Enter customer's full name"
              />
            </div>

            {/* Customer Phone */}
            <div>
              <label htmlFor="customer_phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                id="customer_phone"
                name="customer_phone"
                value={formData.customer_phone}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="08012345678"
              />
            </div>

            {/* Customer Email */}
            <div>
              <label htmlFor="customer_email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address (Optional)
              </label>
              <input
                type="email"
                id="customer_email"
                name="customer_email"
                value={formData.customer_email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="customer@example.com"
              />
            </div>

            {/* Service Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Services (Optional)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3">
                {services.map(service => (
                  <label key={service.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg">
                    <input
                      type="checkbox"
                      checked={selectedServices.includes(service.id)}
                      onChange={() => handleServiceToggle(service.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <span className="text-sm text-gray-700 block">{service.name}</span>
                      <span className="text-xs text-gray-500">
                        ₦{parseFloat(service.price).toLocaleString()} • {service.duration}min
                      </span>
                    </div>
                  </label>
                ))}
                {services.length === 0 && (
                  <div className="text-sm text-gray-500 col-span-2 text-center py-4">
                    No services available
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Select services if customer knows what they want, or leave empty for manager to assign later
              </p>
              
              {/* Total Price Display */}
              {selectedServices.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">Total Amount:</span>
                    <span className="font-semibold text-blue-600">
                      ₦{calculateTotalPrice().toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-600 mt-1">
                    <span>Total Duration:</span>
                    <span>{calculateTotalDuration()} minutes</span>
                  </div>
                </div>
              )}
            </div>

            {/* Worker Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign Workers (Optional)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3">
                {workers.map(worker => {
                  const isSelected = selectedWorkers.includes(worker.id);
                  const isBusy = busyWorkers.some(bw => bw.worker_id === worker.id);
                  
                  return (
                    <label key={worker.id} className={`flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg ${
                      isBusy ? 'opacity-60' : ''
                    }`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleWorkerToggle(worker.id)}
                        disabled={isBusy}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <div className="flex-1">
                        <span className={`text-sm ${isBusy ? 'text-gray-500' : 'text-gray-700'}`}>
                          {worker.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{worker.role}</span>
                          {isBusy && (
                            <span className="text-xs text-orange-600 font-medium">
                              Busy today
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
                {workers.length === 0 && (
                  <div className="text-sm text-gray-500 col-span-2 text-center py-4">
                    No workers available
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Select one or more workers to assign to this booking, or leave empty for manager to assign later
              </p>
              {busyWorkers.length > 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  Workers marked as "Busy today" are currently assigned to other bookings
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Any special requests or notes for the manager..."
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creating Booking...
                  </div>
                ) : (
                  'Create Walk-In Booking'
                )}
              </button>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-blue-600 text-xl">💡</span>
                <div>
                  <h4 className="font-semibold text-blue-800 mb-1">How it works:</h4>
                  <p className="text-blue-700 text-sm">
                    This creates a walk-in booking. You can optionally select services and assign one or more workers now, 
                    or the manager will assign them later in the booking management page.
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default WalkInBooking;