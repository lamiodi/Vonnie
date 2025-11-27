import React from 'react';
import { useLocation, Link } from 'react-router-dom';

const BookingConfirmation = () => {
  const location = useLocation();
  const bookingData = location.state?.bookingData;
  const paymentCompleted = location.state?.paymentCompleted || false;

  console.log('BookingConfirmation received data:', bookingData);
  console.log('BookingConfirmation received paymentCompleted:', paymentCompleted);
  console.log('Booking data structure:', {
    booking_number: bookingData?.booking_number,
    total_amount: bookingData?.total_amount,
    customer_name: bookingData?.customer_name,
    customer_email: bookingData?.customer_email,
    customer_phone: bookingData?.customer_phone,
    booking_date: bookingData?.booking_date,
    booking_time: bookingData?.booking_time,
    service_name: bookingData?.service_name,
    duration: bookingData?.duration,
    status: bookingData?.status,
    payment_status: bookingData?.payment_status
  });

  if (!bookingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">No Booking Found</h1>
          <p className="text-gray-600 mb-6">It looks like you haven't made a booking yet.</p>
          <Link
            to="/public-booking"
            className="inline-block px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg"
          >
            Make a Booking
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Date to be confirmed';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'Time to be confirmed';
    
    if (timeString.includes('T')) {
      const date = new Date(timeString);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }
    
    return timeString;
  };

  const formatCurrency = (amount) => {
    // Handle null, undefined, NaN, or invalid amounts
    if (amount === null || amount === undefined || isNaN(amount) || amount === '') {
      return '₦0';
    }
    
    // Convert to number if it's a string
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Check again if it's NaN after conversion
    if (isNaN(numericAmount)) {
      return '₦0';
    }
    
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(numericAmount);
    
    return formatted.replace(/\.00$/, '');
  };

  // Determine the confirmation message based on payment status
  const getConfirmationTitle = () => {
    if (paymentCompleted || bookingData.payment_status === 'completed') {
      return 'Booking & Payment Confirmed!';
    } else if (bookingData.payment_status === 'pending') {
      return 'Booking Confirmed - Payment Pending!';
    }
    return 'Booking Confirmed!';
  };

  const getConfirmationMessage = () => {
    if (paymentCompleted || bookingData.payment_status === 'completed') {
      return 'Your appointment has been successfully scheduled and payment confirmed.';
    } else if (bookingData.payment_status === 'pending') {
      return 'Your appointment is scheduled. Please complete payment to confirm your booking.';
    }
    return 'Your appointment has been successfully scheduled';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 text-center">
          <div className={`mb-4 ${
            paymentCompleted || bookingData.payment_status === 'completed' ? 'text-green-500' :
            bookingData.payment_status === 'pending' ? 'text-yellow-500' :
            'text-green-500'
          }`}>
            <svg className="w-20 h-20 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-3.414-3.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {getConfirmationTitle()}
          </h1>
          <p className="text-gray-600 text-lg">
            {getConfirmationMessage()}
          </p>
          
          {/* Payment Status Banner */}
          {paymentCompleted && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">
                ✅ Payment has been successfully processed!
              </p>
            </div>
          )}
        </div>

        {/* Rest of the component remains the same... */}
        {/* Important Notice */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mb-6 rounded-r-xl">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Important: Save Your Booking Number</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Please take a screenshot or save your booking number below. You'll need it to manage your appointment.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Details */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Booking Details</h2>
          
          {/* Booking Number */}
          <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl p-6 mb-6">
            <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">Your Booking Number</p>
                <div className="text-3xl font-bold text-purple-600 mb-2 font-mono tracking-wider">
                  {bookingData.booking_number || 'Generating...'}
                </div>
                {bookingData.booking_number && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(bookingData.booking_number);
                      alert('Booking number copied to clipboard!');
                    }}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm"
                  >
                    Copy Number
                  </button>
                )}
              </div>
          </div>

          {/* Rest of the booking details... */}
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <span className="text-gray-600 font-medium">Service:</span>
              <span className="text-gray-800 font-semibold">
                {bookingData.service_name || 'Service to be confirmed'}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <span className="text-gray-600 font-medium">Date:</span>
              <span className="text-gray-800 font-semibold">
                {formatDate(bookingData.booking_date)}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <span className="text-gray-600 font-medium">Time:</span>
              <span className="text-gray-800 font-semibold">
                {formatTime(bookingData.booking_time)}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <span className="text-gray-600 font-medium">Duration:</span>
              <span className="text-gray-800 font-semibold">
                {bookingData.duration ? `${bookingData.duration} minutes` : 'Duration to be confirmed'}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <span className="text-gray-600 font-medium">Customer Name:</span>
              <span className="text-gray-800 font-semibold">
                {bookingData.customer_name || 'Name not provided'}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <span className="text-gray-600 font-medium">Email:</span>
              <span className="text-gray-800 font-semibold">
                {bookingData.customer_email || 'Email not provided'}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <span className="text-gray-600 font-medium">Phone:</span>
              <span className="text-gray-800 font-semibold">
                {bookingData.customer_phone || 'Phone not provided'}
              </span>
            </div>
            
            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <span className="text-gray-600 font-medium">Booking Status:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                bookingData.status === 'scheduled' ? 'bg-green-100 text-green-800' :
                bookingData.status === 'pending_confirmation' ? 'bg-yellow-100 text-yellow-800' :
                bookingData.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                bookingData.status === 'completed' ? 'bg-purple-100 text-purple-800' :
                bookingData.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {bookingData.status ? 
                  bookingData.status.charAt(0).toUpperCase() + bookingData.status.slice(1) : 
                  'Status pending'
                }
              </span>
            </div>
            
            {bookingData.payment_status && (
              <div className="flex justify-between items-center py-3 border-b border-gray-200">
                <span className="text-gray-600 font-medium">Payment Status:</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  bookingData.payment_status === 'completed' ? 'bg-green-100 text-green-800' :
                  bookingData.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  bookingData.payment_status === 'failed' ? 'bg-red-100 text-red-800' :
                  bookingData.payment_status === 'refunded' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {bookingData.payment_status ? 
                    bookingData.payment_status.charAt(0).toUpperCase() + bookingData.payment_status.slice(1) : 
                    'Payment status unknown'
                  }
                </span>
              </div>
            )}
            
            {bookingData.notes && (
              <div className="flex justify-between items-start py-3 border-b border-gray-200">
                <span className="text-gray-600 font-medium">Notes:</span>
                <span className="text-gray-800 font-semibold text-right max-w-xs">{bookingData.notes}</span>
              </div>
            )}
            
            <div className="flex justify-between items-center py-3">
              <span className="text-gray-600 font-medium">Total Amount:</span>
              <span className="text-2xl font-bold text-purple-600">
                {formatCurrency(bookingData.total_amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <p className="text-gray-600 mb-6">A confirmation email has been sent to your email address.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/public-booking"
              className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg"
            >
              Make Another Booking
            </Link>
            <button
              onClick={() => window.print()}
              className="px-8 py-3 border-2 border-purple-500 text-purple-500 rounded-xl font-medium hover:bg-purple-50 transition-all duration-300"
            >
              Print This Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;