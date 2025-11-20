import React from 'react';
import { usePaystackPayment } from 'react-paystack';

const PaystackPayment = ({ 
  amount, 
  email, 
  onSuccess, 
  onClose, 
  publicKey,
  metadata = {},
  reference,
  currency = 'NGN',
  bookingNumber,
  buttonText,
  buttonClass
}) => {
  const config = {
    reference: reference || `${bookingNumber}_${new Date().getTime()}`,
    email: email,
    amount: amount * 100, // Convert to kobo
    publicKey: publicKey || import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
    currency: currency,
    metadata: {
      ...metadata,
      booking_number: bookingNumber,
      custom_fields: [
        {
          display_name: "Payment For",
          variable_name: "payment_for",
          value: "Booking Payment"
        }
      ]
    }
  };

  const initializePayment = usePaystackPayment(config);

  const handlePayment = () => {
    console.log('Initializing Paystack payment...');
    console.log('Config:', config);
    
    const handleSuccess = (reference) => {
      console.log('Paystack payment success:', reference);

      // Use booking number from props instead of localStorage
      const bookingData = {
        booking_number: config.metadata.booking_number,
        payment_status: 'completed'
      };

      // Post a PAYMENT_SUCCESS message to this window; PublicBooking listens and will navigate
      try {
        const payload = {
          type: 'PAYMENT_SUCCESS',
          reference,
          bookingData: bookingData
        };
        console.log('Posting PAYMENT_SUCCESS to window');
        window.postMessage(payload, '*');
      } catch (e) {
        console.warn('Error posting PAYMENT_SUCCESS message:', e);
      }

      if (onSuccess) {
        try {
          onSuccess({ reference, bookingData: bookingData });
        } catch (e) {
          console.warn('Error calling onSuccess with bookingData, falling back to reference only:', e);
          onSuccess(reference);
        }
      }

      // Add a small delay to ensure popup closes properly
      setTimeout(() => {
        console.log('Attempting to close popup...');
        if (window.close) {
          window.close();
        }
      }, 100);
    };
    
    const handleClose = () => {
      console.log('Paystack payment closed');
      if (onClose) {
        onClose();
      }
    };
    
    initializePayment(handleSuccess, handleClose);
  };

  return (
    <button
      onClick={handlePayment}
      className={buttonClass || "w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200"}
    >
      {buttonText || `Pay ₦${amount.toLocaleString()} Now`}
    </button>
  );
};

export default PaystackPayment;