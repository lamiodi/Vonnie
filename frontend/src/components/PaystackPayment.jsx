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
  bookingData: fullBookingData,
  buttonText,
  buttonClass,
  onRetry,
  maxRetries = 3
}) => {
  const [retryCount, setRetryCount] = React.useState(0);
  const [isVerifying, setIsVerifying] = React.useState(false);
  
  // Validate booking number before using it
  const validatedBookingNumber = bookingNumber && bookingNumber !== 'Pending...' && bookingNumber !== 'Generating...' ? bookingNumber : null;
  
  if (!validatedBookingNumber) {
    console.error('Invalid booking number provided to PaystackPayment:', bookingNumber);
  }

  const config = {
    reference: reference || `${validatedBookingNumber || 'TEMP'}_${new Date().getTime()}`,
    email: email,
    amount: amount * 100, // Convert to kobo
    publicKey: publicKey || import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
    currency: currency,
    metadata: {
      ...metadata,
      booking_number: validatedBookingNumber || 'TEMP_BOOKING',
      retry_count: retryCount,
      verification_method: 'enhanced',
      custom_fields: [
        {
          display_name: "Payment For",
          variable_name: "payment_for",
          value: "Booking Payment"
        },
        {
          display_name: "Booking Number",
          variable_name: "booking_number",
          value: validatedBookingNumber || 'TEMP_BOOKING'
        }
      ]
    }
  };

  const initializePayment = usePaystackPayment(config);

  const verifyPaymentWithRetry = async (reference) => {
    setIsVerifying(true);
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Payment verification attempt ${attempt + 1} for reference: ${reference}`);
        
        const response = await fetch('/api/public/payment/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reference })
        });

        const result = await response.json();
        
        if (result.success) {
          console.log('Payment verification successful:', result);
          setIsVerifying(false);
          return result;
        } else {
          console.log(`Verification attempt ${attempt + 1} failed:`, result);
          
          if (attempt < maxRetries - 1) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          }
        }
      } catch (error) {
        console.error(`Verification attempt ${attempt + 1} error:`, error);
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    setIsVerifying(false);
    return null;
  };

  const handlePayment = () => {
    console.log('Initializing Paystack payment...');
    console.log('Config:', config);
    
    const handleSuccess = async (reference) => {
      console.log('Paystack payment success:', reference);
      
      // Enhanced verification with retry logic
      const verificationResult = await verifyPaymentWithRetry(reference);
      
      if (verificationResult) {
        console.log('Payment verification completed successfully');
        
        // Use booking number from props instead of localStorage
        const bookingData = {
          ...(fullBookingData || {}),
          booking_number: config.metadata.booking_number,
          payment_status: 'completed',
          verification_method: verificationResult.method || 'enhanced',
          verification_attempts: retryCount + 1
        };

        // Post a PAYMENT_SUCCESS message to this window; PublicBooking listens and will navigate
        try {
          const payload = {
            type: 'PAYMENT_SUCCESS',
            reference,
            bookingData: bookingData,
            verificationResult: verificationResult
          };
          console.log('Posting PAYMENT_SUCCESS to window');
          window.postMessage(payload, '*');
        } catch (e) {
          console.warn('Error posting PAYMENT_SUCCESS message:', e);
        }

        if (onSuccess) {
          try {
            onSuccess({ reference, bookingData: bookingData, verificationResult });
          } catch (e) {
            console.warn('Error calling onSuccess with bookingData, falling back to reference only:', e);
            onSuccess(reference);
          }
        }
      } else {
        console.error('Payment verification failed after all retries');
        
        if (onRetry && retryCount < maxRetries - 1) {
          setRetryCount(retryCount + 1);
          console.log(`Retrying payment verification (attempt ${retryCount + 2})`);
          onRetry({ reference, attempt: retryCount + 1 });
        } else {
          console.error('Maximum verification retries exceeded');
          const bookingData = {
            ...(fullBookingData || {}),
            booking_number: config.metadata.booking_number,
            payment_status: 'completed',
            verification_warning: 'verification_failed_after_retries'
          };
          try {
            const payload = {
              type: 'PAYMENT_SUCCESS',
              reference,
              bookingData: bookingData,
              verificationResult: null
            };
            window.postMessage(payload, '*');
          } catch (e) {}
          if (onSuccess) {
            onSuccess({ reference, bookingData });
          }
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
