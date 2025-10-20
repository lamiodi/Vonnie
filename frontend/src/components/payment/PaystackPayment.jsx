import React, { useState } from 'react'
import { PaystackButton } from 'react-paystack'
import { CreditCard, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

const PaystackPayment = ({
  amount,
  email,
  firstName,
  lastName,
  phone,
  reference,
  onSuccess,
  onClose,
  metadata = {},
  className = '',
  disabled = false,
  children,
  variant = 'primary'
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY

  if (!publicKey || publicKey === 'pk_test_your_paystack_public_key_here') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            Paystack not configured. Please add your Paystack public key to the environment variables.
          </p>
        </div>
      </div>
    )
  }

  const config = {
    reference: reference || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email,
    amount: Math.round(amount * 100), // Convert to kobo
    publicKey,
    firstname: firstName,
    lastname: lastName,
    phone,
    metadata: {
      custom_fields: [
        {
          display_name: 'Payment For',
          variable_name: 'payment_for',
          value: metadata.service || 'Service Payment'
        },
        {
          display_name: 'Customer Name',
          variable_name: 'customer_name',
          value: `${firstName} ${lastName}`
        }
      ],
      ...metadata
    }
  }

  const handleSuccess = (response) => {
    setIsLoading(false)
    setError('')
    if (onSuccess) {
      onSuccess({
        reference: response.reference,
        status: 'success',
        transaction: response.transaction,
        message: 'Payment completed successfully'
      })
    }
  }

  const handleClose = () => {
    setIsLoading(false)
    if (onClose) {
      onClose()
    }
  }

  const componentProps = {
    ...config,
    text: children || 'Pay Now',
    onSuccess: handleSuccess,
    onClose: handleClose,
    disabled: disabled || isLoading
  }

  const buttonVariants = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white',
    secondary: 'bg-secondary-600 hover:bg-secondary-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50'
  }

  return (
    <div className={cn('w-full', className)}>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      <PaystackButton
        {...componentProps}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
          buttonVariants[variant],
          className
        )}
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            {children || `Pay ₦${amount.toLocaleString()}`}
          </>
        )}
      </PaystackButton>

      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
        <Lock className="w-3 h-3" />
        <span>Secured by Paystack</span>
      </div>
    </div>
  )
}

// Payment verification component
export const PaymentVerification = ({ reference, onVerified, onError }) => {
  const [isVerifying, setIsVerifying] = useState(false)
  const [status, setStatus] = useState('pending')

  const verifyPayment = async () => {
    setIsVerifying(true)
    try {
      // This would typically call your backend API to verify the payment
      const response = await fetch(`${import.meta.env.VITE_API_URL}/payments/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (data.status === 'success') {
        setStatus('verified')
        if (onVerified) onVerified(data)
      } else {
        setStatus('failed')
        if (onError) onError(data.message || 'Payment verification failed')
      }
    } catch (error) {
      setStatus('failed')
      if (onError) onError('Network error during verification')
    } finally {
      setIsVerifying(false)
    }
  }

  React.useEffect(() => {
    if (reference) {
      verifyPayment()
    }
  }, [reference])

  if (status === 'pending' || isVerifying) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Verifying payment...</p>
        </div>
      </div>
    )
  }

  if (status === 'verified') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Verified!</h3>
          <p className="text-gray-600">Your payment has been successfully processed.</p>
        </div>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Verification Failed</h3>
          <p className="text-gray-600 mb-4">We couldn't verify your payment. Please contact support.</p>
          <button
            onClick={verifyPayment}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Retry Verification
          </button>
        </div>
      </div>
    )
  }

  return null
}

// Payment summary component
export const PaymentSummary = ({ items, total, currency = 'NGN' }) => {
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
      <h3 className="font-semibold text-gray-900">Payment Summary</h3>
      
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span className="text-gray-600">{item.name}</span>
            <span className="font-medium">₦{item.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
      
      <div className="border-t pt-2">
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>₦{total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

export default PaystackPayment