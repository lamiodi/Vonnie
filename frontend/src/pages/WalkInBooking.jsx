import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleError, handleSuccess } from '../utils/errorHandler';
import { apiGet, apiPost, API_ENDPOINTS } from '../utils/api';
import { createNigeriaISOString } from '../utils/formatters';
import { isValidCustomerType } from '../utils/bookingUtils';
import '@fontsource/patrick-hand';
import '@fontsource/unifrakturcook';

const WalkInBooking = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    notes: ''
  });

  // Fetch services on component mount
  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const data = await apiGet(API_ENDPOINTS.SERVICES);
      setServices(Array.isArray(data) ? data : (data.data || []));
    } catch (error) {
      try {
        // Fallback to public endpoint if authenticated endpoint fails
        const fallback = await apiGet(API_ENDPOINTS.PUBLIC_SERVICES);
        setServices(Array.isArray(fallback) ? fallback : (fallback.data || []));
      } catch (fallbackError) {
        console.error('Error fetching services:', fallbackError);
        setServices([]);
      }
    }
  };



  const handleServiceToggle = (serviceId) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
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

  // Service icons mapping
  const serviceIcons = {
    'Hair Styling': (
      <svg className="w-full h-32 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M8,8A2,2 0 0,0 6,10A2,2 0 0,0 8,12A2,2 0 0,0 10,10A2,2 0 0,0 8,8M16,8A2,2 0 0,0 14,10A2,2 0 0,0 16,12A2,2 0 0,0 18,10A2,2 0 0,0 16,8M8,14C9.11,14 10,14.45 10,15C10,15.55 9.11,16 8,16C6.89,16 6,15.55 6,15C6,14.45 6.89,14 8,14M16,14C17.11,14 18,14.45 18,15C18,15.55 17.11,16 16,16C14.89,16 14,15.55 14,15C14,14.45 14.89,14 16,14Z"/>
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f1f2' }}>
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-4" style={{ fontFamily: '"Patrick Hand", cursive' }}>
            Walk-In Booking
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            Quick booking for walk-in customers
          </p>
          <p className="text-sm text-gray-500">
            Optional service selection • Professional beauty services • Instant confirmation
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <form onSubmit={handleSubmit}>
            {/* Customer Details Section */}
          <div className="mb-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2" style={{ fontFamily: '"UnifrakturCook", cursive' }}>
                Customer Information
              </h2>
              <p className="text-gray-600">Fill in the customer details for the walk-in booking</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  placeholder="08012345678"
                />
              </div>

              {/* Customer Email */}
              <div className="md:col-span-2">
                <label htmlFor="customer_email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address (for receipts)
                </label>
                <input
                  type="email"
                  id="customer_email"
                  name="customer_email"
                  value={formData.customer_email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  placeholder="Email for sending receipts (optional)"
                />
              </div>
            </div>
          </div>

            {/* Service Selection */}
            <div>
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2" style={{ fontFamily: '"UnifrakturCook", cursive' }}>
                  Select Services
                </h2>
                <p className="text-gray-600">Choose beauty services for the walk-in customer (optional)</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {services.map(service => {
                  const isSelected = selectedServices.includes(service.id);
                  return (
                    <div
                      key={service.id}
                      className={`relative cursor-pointer rounded-2xl border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                        isSelected
                          ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                      onClick={() => handleServiceToggle(service.id)}
                    >
                      <div className="p-6">
                        <div className="mb-4 flex justify-center">
                          {serviceIcons[service.name] || serviceIcons.default}
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
              
              {services.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-gray-500 text-lg">No services available</div>
                  <p className="text-gray-400 text-sm mt-2">Services can be assigned later by the manager</p>
                </div>
              )}
              
              <p className="text-xs text-gray-500 mt-6">
                Select services if customer knows what they want, or leave empty for manager to assign later
              </p>
              
              {/* Total Price Display */}
              {selectedServices.length > 0 && (
                <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border-2 border-purple-100">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2" style={{ fontFamily: '"UnifrakturCook", cursive' }}>
                    <span>🛒</span>
                    Selected Services ({selectedServices.length})
                  </h3>
                  <div className="space-y-3">
                    {selectedServices.map((serviceId, index) => {
                      const service = services.find(s => s.id === serviceId);
                      return (
                        <div key={serviceId} className="flex justify-between items-center bg-white p-3 rounded-xl">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </span>
                            <div>
                              <span className="text-gray-800 font-medium">{service?.name}</span>
                              <span className="text-gray-500 text-sm ml-2">({service?.duration || 60} min)</span>
                            </div>
                          </div>
                          <span className="font-semibold text-purple-600">₦{parseFloat(service?.price || 0).toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-purple-200">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-800 font-semibold">Total Amount:</span>
                      <span className="text-xl font-bold text-purple-600">₦{calculateTotalPrice().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-gray-600 mt-1">
                      <span>Total Duration:</span>
                      <span>{calculateTotalDuration()} minutes</span>
                    </div>
                  </div>
                </div>
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
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
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
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <span className="text-purple-600 text-xl">💡</span>
                <div>
                  <h4 className="font-semibold text-purple-800 mb-1" style={{ fontFamily: '"UnifrakturCook", cursive' }}>How it works:</h4>
                  <p className="text-purple-700 text-sm">
                    This creates a walk-in booking. You can optionally select services now, 
                    or the manager will assign services and workers later in the booking management page.
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