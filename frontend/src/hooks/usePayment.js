import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'

// Payment service functions
const paymentService = {
  // Initialize payment
  initializePayment: async (paymentData) => {
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payments/initialize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(paymentData)
    })
    
    if (!response.ok) {
      throw new Error('Failed to initialize payment')
    }
    
    return response.json()
  },

  // Verify payment
  verifyPayment: async (reference) => {
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payments/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to verify payment')
    }
    
    return response.json()
  },

  // Get payment history
  getPaymentHistory: async (filters = {}) => {
    const params = new URLSearchParams(filters)
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payments/history?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch payment history')
    }
    
    return response.json()
  },

  // Process refund
  processRefund: async (paymentId, amount, reason) => {
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ amount, reason })
    })
    
    if (!response.ok) {
      throw new Error('Failed to process refund')
    }
    
    return response.json()
  }
}

// Main payment hook
export const usePayment = () => {
  const [paymentState, setPaymentState] = useState({
    isProcessing: false,
    currentPayment: null,
    error: null
  })
  
  const queryClient = useQueryClient()

  // Initialize payment mutation
  const initializePaymentMutation = useMutation({
    mutationFn: paymentService.initializePayment,
    onSuccess: (data) => {
      setPaymentState(prev => ({
        ...prev,
        currentPayment: data,
        error: null
      }))
      toast.success('Payment initialized successfully')
    },
    onError: (error) => {
      setPaymentState(prev => ({
        ...prev,
        error: error.message
      }))
      toast.error('Failed to initialize payment')
    }
  })

  // Verify payment mutation
  const verifyPaymentMutation = useMutation({
    mutationFn: paymentService.verifyPayment,
    onSuccess: (data) => {
      setPaymentState(prev => ({
        ...prev,
        isProcessing: false,
        error: null
      }))
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      
      if (data.status === 'success') {
        toast.success('Payment verified successfully!')
      } else {
        toast.error('Payment verification failed')
      }
    },
    onError: (error) => {
      setPaymentState(prev => ({
        ...prev,
        isProcessing: false,
        error: error.message
      }))
      toast.error('Payment verification failed')
    }
  })

  // Refund mutation
  const refundMutation = useMutation({
    mutationFn: ({ paymentId, amount, reason }) => 
      paymentService.processRefund(paymentId, amount, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      toast.success('Refund processed successfully')
    },
    onError: () => {
      toast.error('Failed to process refund')
    }
  })

  // Helper functions
  const initializePayment = useCallback(async (paymentData) => {
    setPaymentState(prev => ({ ...prev, isProcessing: true, error: null }))
    return initializePaymentMutation.mutateAsync(paymentData)
  }, [initializePaymentMutation])

  const verifyPayment = useCallback(async (reference) => {
    setPaymentState(prev => ({ ...prev, isProcessing: true, error: null }))
    return verifyPaymentMutation.mutateAsync(reference)
  }, [verifyPaymentMutation])

  const processRefund = useCallback(async (paymentId, amount, reason) => {
    return refundMutation.mutateAsync({ paymentId, amount, reason })
  }, [refundMutation])

  // Payment flow for booking
  const processBookingPayment = useCallback(async (bookingData) => {
    try {
      setPaymentState(prev => ({ ...prev, isProcessing: true, error: null }))
      
      const paymentData = {
        amount: bookingData.totalAmount,
        email: bookingData.customerEmail,
        firstName: bookingData.customerName.split(' ')[0],
        lastName: bookingData.customerName.split(' ').slice(1).join(' '),
        phone: bookingData.customerPhone,
        metadata: {
          bookingId: bookingData.id,
          service: bookingData.serviceName,
          customer: bookingData.customerName,
          bookingDate: bookingData.date,
          bookingTime: bookingData.time
        }
      }
      
      const result = await initializePayment(paymentData)
      return result
    } catch (error) {
      setPaymentState(prev => ({
        ...prev,
        isProcessing: false,
        error: error.message
      }))
      throw error
    }
  }, [initializePayment])

  // Generate payment reference
  const generatePaymentReference = useCallback((prefix = 'VX2X') => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `${prefix}_${timestamp}_${random}`
  }, [])

  // Format amount for display
  const formatAmount = useCallback((amount, currency = 'NGN') => {
    const formatter = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    })
    return formatter.format(amount)
  }, [])

  // Calculate service charge (if any)
  const calculateServiceCharge = useCallback((amount, rate = 0.015) => {
    return Math.round(amount * rate)
  }, [])

  return {
    // State
    ...paymentState,
    isLoading: initializePaymentMutation.isPending || 
               verifyPaymentMutation.isPending || 
               refundMutation.isPending,
    
    // Actions
    initializePayment,
    verifyPayment,
    processRefund,
    processBookingPayment,
    
    // Utilities
    generatePaymentReference,
    formatAmount,
    calculateServiceCharge,
    
    // Reset state
    resetPaymentState: () => setPaymentState({
      isProcessing: false,
      currentPayment: null,
      error: null
    })
  }
}

// Hook for payment history
export const usePaymentHistory = (filters = {}) => {
  return useQuery({
    queryKey: ['payments', 'history', filters],
    queryFn: () => paymentService.getPaymentHistory(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Payment status constants
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
}

// Payment method constants
export const PAYMENT_METHODS = {
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  USSD: 'ussd',
  QR: 'qr'
}

export default usePayment