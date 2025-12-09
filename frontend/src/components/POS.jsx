import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { useSearchParams } from 'react-router-dom';
import { handleError, handleSuccess } from '../utils/errorHandler';
import { toast } from 'react-hot-toast';
import { apiGet, apiPost, apiPatch, API_ENDPOINTS } from '../utils/api';
import { generatePaystackReference, generateBankTransferReference, generatePOSReference } from '../utils/paymentUtils';

const POS = () => {
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState('');
  const [skuInput, setSkuInput] = useState('');
  const [scanningMode, setScanningMode] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [apiOnline, setApiOnline] = useState(true);
  const [paystackReference, setPaystackReference] = useState("");
  const [bookingNumber, setBookingNumber] = useState('');
  const [bookingData, setBookingData] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [activeTab, setActiveTab] = useState('products');
  const [searchParams, setSearchParams] = useSearchParams();
  // Receipt modal removed per request; provide success via toasts and inline messages instead
  // Helper function to format prices without showing .00
  const formatPrice = (price) => {
    const formattedPrice = parseFloat(price).toFixed(2);
    if (formattedPrice.endsWith('.00')) {
      return formattedPrice.substring(0, formattedPrice.length - 3);
    }
    return formattedPrice;
  };
  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'hair_products', label: 'Hair Products' },
    { value: 'nail_products', label: 'Nail Products' },
    { value: 'skin_care', label: 'Skin Care' },
    { value: 'tools', label: 'Tools & Equipment' },
    { value: 'accessories', label: 'Accessories' }
  ];
  const serviceCategories = [
    { value: '', label: 'All Services' },
    { value: 'hair', label: 'Hair Services' },
    { value: 'nail', label: 'Nail Services' },
    { value: 'skin', label: 'Skin Care Services' },
    { value: 'massage', label: 'Massage Services' },
    { value: 'makeup', label: 'Makeup Services' },
    { value: 'other', label: 'Other Services' }
  ];
  useEffect(() => {
    fetchProducts();
    fetchServices();
  }, []);
  useEffect(() => {
    (async () => {
      try {
        await apiGet(API_ENDPOINTS.PUBLIC_SERVICES);
        setApiOnline(true);
      } catch (e) {
        setApiOnline(false);
      }
    })();
  }, []);
  // Handle URL parameters to automatically load bookings
  useEffect(() => {
    const bookingId = searchParams.get('booking_id');
    const customerId = searchParams.get('customer_id');
  
    if (bookingId) {
      // Fetch booking by ID
      fetchBookingById(bookingId);
    
      // Clear URL parameters after loading
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('booking_id');
      newSearchParams.delete('customer_id');
      setSearchParams(newSearchParams);
    }
  }, [searchParams]);
  const fetchBookingById = async (bookingId) => {
    try {
      setBookingLoading(true);
      const response = await apiGet(`${API_ENDPOINTS.BOOKINGS}/${bookingId}`);
    
      if (response) {
        const booking = response;
        // Allow bookings with statuses aligned to backend schema
        const allowedStatuses = ['scheduled', 'in-progress', 'completed'];
      
        if (!allowedStatuses.includes(booking.status)) {
          handleError(null, `Booking cannot be processed. Current status: ${booking.status}. Only bookings with status 'Scheduled', 'In Progress', or 'Completed' can be processed through POS.`);
          setBookingData(null);
          return;
        }
      
        setBookingData(booking);
        setBookingNumber(booking.booking_number || '');
        setCustomerInfo({
          name: booking.customer_name || '',
          email: booking.customer_email || '',
          phone: booking.customer_phone || ''
        });
      
        // Auto-update status to 'in-progress' for walk-in customers
        const isWalkIn = booking.customer_type === 'walk_in' || booking.customer_type === 'walk-in';
        if (isWalkIn && booking.status === 'scheduled') {
          try {
            await apiPatch(`${API_ENDPOINTS.BOOKINGS}/${booking.id}`, {
              status: 'in-progress',
              updated_at: new Date().toISOString()
            });
            setBookingData({ ...booking, status: 'in-progress' });
            handleSuccess(`Walk-in customer ${booking.customer_name} is now in service! Service: ${booking.service_names ? booking.service_names.join(', ') : 'N/A'}`);
          } catch (updateError) {
            console.error('Error updating booking status:', updateError);
            handleSuccess(`Booking loaded! Customer: ${booking.customer_name}, Service: ${booking.service_names ? booking.service_names.join(', ') : 'N/A'}`);
          }
        } else {
          handleSuccess(`Booking loaded! Customer: ${booking.customer_name}, Service: ${booking.service_names ? booking.service_names.join(', ') : 'N/A'}`);
        }
      }
    } catch (error) {
      console.error('Error fetching booking by ID:', error);
      handleError(error, 'Error loading booking. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };
  const fetchProducts = async () => {
    try {
      const response = await apiGet(API_ENDPOINTS.INVENTORY);
      setProducts(response.filter(product => product.stock_level > 0));
    } catch (error) {
      console.error('Error fetching products:', error);
      handleError(error, 'Failed to fetch products.');
    } finally {
      setLoading(false);
    }
  };
  const fetchServices = async () => {
    try {
      // Fix: Use API_ENDPOINTS.SERVICES instead of hardcoded path
      const response = await apiGet(API_ENDPOINTS.SERVICES);
      setServices(response);
    } catch (error) {
      console.error('Error fetching services:', error);
      handleError(error, 'Failed to fetch services.');
    }
  };
  const fetchBooking = async () => {
    if (!bookingNumber.trim()) {
      handleError(null, 'Please enter a booking number');
      return;
    }
    setBookingLoading(true);
    try {
      const response = await apiGet(API_ENDPOINTS.BOOKINGS, { booking_number: bookingNumber });
      // Handle both array and single object responses
      const booking = Array.isArray(response) ? (response.length > 0 ? response[0] : null) : response;
    
      if (booking) {
      
        // Allow bookings with statuses aligned to backend schema
        const allowedStatuses = ['scheduled', 'in-progress', 'completed'];
        if (!allowedStatuses.includes(booking.status)) {
          handleError(null, `Booking cannot be processed. Current status: ${booking.status}. Only bookings with status 'Scheduled', 'In Progress', or 'Completed' can be processed through POS.`);
          setBookingData(null);
          setBookingLoading(false);
          return;
        }
      
        setBookingData(booking);
        setCustomerInfo({
          name: booking.customer_name || '',
          email: booking.customer_email || '',
          phone: booking.customer_phone || ''
        });
      
        // Auto-update status to 'in-progress' for walk-in customers
        const isWalkIn = booking.customer_type === 'walk_in' || booking.customer_type === 'walk-in';
        if (isWalkIn && booking.status === 'scheduled') {
          try {
            await apiPatch(`${API_ENDPOINTS.BOOKINGS}/${booking.id}`, {
              status: 'in-progress',
              updated_at: new Date().toISOString()
            });
            setBookingData({ ...booking, status: 'in-progress' });
            handleSuccess(`Walk-in customer ${booking.customer_name} is now in service! Service: ${booking.service_names ? booking.service_names.join(', ') : 'N/A'}`);
          } catch (updateError) {
            console.error('Error updating booking status:', updateError);
            handleSuccess(`Booking found! Customer: ${booking.customer_name}, Service: ${booking.service_names ? booking.service_names.join(', ') : 'N/A'}`);
          }
        } else {
          handleSuccess(`Booking found! Customer: ${booking.customer_name}, Service: ${booking.service_names ? booking.service_names.join(', ') : 'N/A'}`);
        }
      } else {
        handleError(null, 'Booking not found');
        setBookingData(null);
      }
    } catch (error) {
      console.error('Error fetching booking:', error);
      handleError(error, 'Error fetching booking. Please try again.');
      setBookingData(null);
    } finally {
      setBookingLoading(false);
    }
  };
  // Memoize functions to prevent unnecessary re-renders
  const fetchBookingByNumber = useCallback(async (number) => {
    try {
      const response = await apiGet(API_ENDPOINTS.BOOKINGS, { booking_number: number });
      // Handle both array and single object responses
      const booking = Array.isArray(response) ? (response.length > 0 ? response[0] : null) : response;
      if (booking) {
        setBookingData(booking);
      }
    } catch (error) {
      console.error('Error fetching booking by number:', error);
    }
  }, []);
  const clearCart = useCallback(() => {
    setCart([]);
    setAppliedCoupon(null);
    setCouponCode('');
    setPaymentConfirmed(false);
  }, []);
  const clearBooking = useCallback(() => {
    setBookingData(null);
    setBookingNumber('');
    setCustomerInfo({ name: '', email: '', phone: '' });
    setPaymentConfirmed(false);
  }, []);
  // Memoize filtered products to improve performance
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);
  // Memoize filtered services to improve performance
  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesSearch = service.name.toLowerCase().includes(serviceSearchTerm.toLowerCase()) ||
                           service.description.toLowerCase().includes(serviceSearchTerm.toLowerCase());
      const matchesCategory = !selectedServiceCategory || service.category === selectedServiceCategory;
      return matchesSearch && matchesCategory;
    });
  }, [services, serviceSearchTerm, selectedServiceCategory]);
  // Memoize calculations to improve performance
  const getSubtotal = useCallback(() => {
    const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const serviceTotal = bookingData ? parseFloat(bookingData.service_price || 0) : 0;
    return cartTotal + serviceTotal;
  }, [cart, bookingData]);
  const getDiscount = useCallback(() => {
    if (!appliedCoupon) return 0;
  
    const subtotal = getSubtotal();
    if (appliedCoupon.discount_type === 'percentage') {
      return (subtotal * appliedCoupon.discount_value) / 100;
    } else {
      return Math.min(appliedCoupon.discount_value, subtotal);
    }
  }, [appliedCoupon, getSubtotal]);
  const getDiscountAmount = useCallback(() => {
    if (!appliedCoupon) return 0;
  
    const subtotal = getSubtotal();
    if (appliedCoupon.discount_type === 'percentage') {
      return (subtotal * appliedCoupon.discount_value) / 100;
    } else {
      return Math.min(appliedCoupon.discount_value, subtotal);
    }
  }, [appliedCoupon, getSubtotal]);
  const getTaxAmount = useCallback(() => {
    return 0; // VAT temporarily disabled
  }, []);
  const getTotal = useCallback(() => {
    const subtotal = getSubtotal();
    const discount = getDiscount();
    return subtotal - discount; // Tax removed
  }, [getSubtotal, getDiscount]);
  const addToCart = useCallback((item, type = 'product') => {
    // Reset payment confirmation when adding new items
    if (paymentConfirmed) {
      setPaymentConfirmed(false);
    }
  
    const existingItem = cart.find(cartItem => cartItem.id === item.id && cartItem.type === type);
  
    if (type === 'service') {
      if (existingItem) {
        setCart(cart.map(cartItem =>
          cartItem.id === item.id && cartItem.type === type
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        ));
      } else {
        setCart([...cart, { ...item, quantity: 1, type: 'service' }]);
      }
    } else {
      // Check product stock availability
      if (item.stock_level <= 0) {
        handleError(null, `Product "${item.name}" is out of stock`);
        return;
      }
      
      if (existingItem) {
        if (existingItem.quantity < item.stock_level) {
          setCart(cart.map(cartItem =>
            cartItem.id === item.id && cartItem.type === type
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          ));
        } else {
          handleError(null, 'Not enough stock available');
        }
      } else {
        setCart([...cart, { ...item, quantity: 1, type: 'product' }]);
      }
    }
  }, [cart, paymentConfirmed]);
  const updateQuantity = useCallback((itemId, newQuantity, itemType = 'product') => {
    if (newQuantity === 0) {
      removeFromCart(itemId, itemType);
      return;
    }
    if (itemType === 'product') {
      const product = products.find(p => p.id === itemId);
      if (newQuantity > product.stock_level) {
        handleError(null, 'Not enough stock available');
        return;
      }
    }
    setCart(cart.map(item =>
      item.id === itemId && item.type === itemType
        ? { ...item, quantity: newQuantity }
        : item
    ));
  }, [cart, products]);
  const removeFromCart = useCallback((itemId, itemType = 'product') => {
    setCart(cart.filter(item => !(item.id === itemId && item.type === itemType)));
  }, [cart]);
  const handleSkuInput = useCallback((e) => {
    const sku = e.target.value;
    setSkuInput(sku);
  
    if (sku.length >= 3 && /^[\dA-Za-z]+$/.test(sku)) {
      searchProductBySku(sku);
    }
  }, []);
  const searchProductBySku = useCallback(async (sku) => {
    try {
      const response = await apiGet(API_ENDPOINTS.INVENTORY_BARCODE(sku));
    
      if (response) {
        const product = response;
        if (scanningMode) {
          addToCart(product);
          setSkuInput('');
          handleSuccess(`Product "${product.name}" added to cart!`);
        } else {
          setSearchTerm(product.name);
          handleSuccess(`Product "${product.name}" found!`);
        }
      }
    } catch (error) {
      console.error('Error searching product by SKU:', error);
      handleError(error, 'Product not found with this SKU');
    }
  }, [scanningMode, addToCart, handleSuccess, handleError]);
  const toggleScanningMode = useCallback(() => {
    setScanningMode(!scanningMode);
    setSkuInput('');
    if (!scanningMode) {
      setTimeout(() => {
        const skuInput = document.querySelector('input[placeholder="Scan or enter SKU..."]');
        if (skuInput) skuInput.focus();
      }, 100);
    }
  }, [scanningMode]);
  const applyCoupon = useCallback(async () => {
    if (!couponCode.trim()) return;
    try {
      const response = await apiPost(API_ENDPOINTS.COUPON_VALIDATE(couponCode), {
        order_amount: getSubtotal()
      });
      setAppliedCoupon(response.coupon || response);
      handleSuccess('Coupon applied successfully!');
    } catch (error) {
      console.error('Error applying coupon:', error);
      handleError(error, 'Invalid or expired coupon code');
    }
  }, [couponCode, getSubtotal]);
  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponCode('');
  }, []);
  const getPaymentStatusColor = useCallback((paymentStatus) => {
    switch (paymentStatus) {
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
  }, []);
  // Paystack Payment Function - Manager-operated workflow
  const handlePaystackPayment = useCallback(() => {
    if (!customerInfo.name || !customerInfo.phone) {
      toast.error("Please provide customer name and phone number");
      return;
    }
    if (getTotal() <= 0) {
      toast.error("Invalid payment amount");
      return;
    }
    // Manager processes payment - use manager's email for Paystack
    const managerEmail = "manager@vonniesalon.com"; // This should come from auth context
  
    const config = {
      reference: generatePaystackReference(),
      email: managerEmail,
      amount: Math.round(getTotal() * 100), // Convert to kobo
      publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      currency: "NGN",
      channels: ["card", "bank", "ussd", "qr", "mobile_money"],
      metadata: {
        booking_id: bookingData?.id,
        custom_fields: [
          {
            display_name: "Customer Name",
            variable_name: "customer_name",
            value: customerInfo.name
          },
          {
            display_name: "Customer Phone",
            variable_name: "customer_phone",
            value: customerInfo.phone
          },
          {
            display_name: "Booking Number",
            variable_name: "booking_number",
            value: bookingData?.booking_number || "Walk-in"
          },
          {
            display_name: "Transaction Type",
            variable_name: "transaction_type",
            value: bookingData ? "Booking + Products" : "Products Only"
          },
          {
            display_name: "Cart Items",
            variable_name: "cart_items",
            value: cart.map(item => `${item.name} x${item.quantity}`).join(", ")
          },
          {
            display_name: "Processed By",
            variable_name: "processed_by",
            value: "Manager" // This should come from auth context
          }
        ]
      }
    };
    const onSuccess = async (response) => {
      try {
        setProcessing(true);
      
        // Create complete POS transaction after Paystack payment
        const transactionData = {
          booking_number: bookingData?.booking_number || null,
          items: cart.map(item => ({
            product_id: item.type === 'product' ? item.id : null,
            service_id: item.type === 'service' ? item.id : null,
            quantity: item.quantity,
            price: item.price,
            type: item.type
          })),
          customer_info: customerInfo,
          coupon_code: appliedCoupon?.code || null,
          tax: getTaxAmount(),
          payment_reference: response.reference,
          payment_method: 'paystack',
          payment_status: 'completed'
        };
        // Process the complete transaction
        const transactionResponse = await apiPost(API_ENDPOINTS.POS_CHECKOUT, transactionData);
      
        // Handle different response structures
        const responseData = transactionResponse.data || transactionResponse;
        const isSuccess = transactionResponse.success !== false && responseData;
      
        if (isSuccess) {
          setPaymentConfirmed(true);
          toast.success("Payment processed and transaction completed successfully!");
        
          const transactionNumber = responseData.transaction_number || responseData.id || 'N/A';
          let successMessage = `Transaction completed! ID: ${transactionNumber}`;
        
          if (responseData.booking_updated && bookingData) {
            successMessage += `\n\nBooking ${bookingData.booking_number} updated to COMPLETED.`;
            successMessage += `\nService: ${bookingData.service_names ? bookingData.service_names.join(', ') : 'N/A'}`;
            successMessage += `\nTotal: ₦${formatPrice(getTotal())}`;
          }
        
          handleSuccess(successMessage);
        
        
          // Refresh booking data after successful payment
          if (bookingData?.booking_number) {
            fetchBookingByNumber(bookingData.booking_number);
          }
        
          // Clear cart and refresh inventory
          clearCart();
          fetchProducts();
        
          // Receipt modal removed; success already shown via toast and handleSuccess
        } else {
          throw new Error("Transaction processing failed");
        }
      } catch (error) {
        console.error("Payment processing error:", error);
        toast.error("Payment processed but transaction failed. Please contact support.");
      } finally {
        setProcessing(false);
      }
    };
    const onClose = () => {
      toast.error("Payment cancelled by manager");
    };
    const initializePayment = usePaystackPayment(config);
    initializePayment(onSuccess, onClose);
  }, [customerInfo, getTotal, bookingData, cart, appliedCoupon, getSubtotal, getDiscount, getTaxAmount, fetchBookingByNumber, handleSuccess, handleError]);
  // Bank Transfer / Physical POS Payment Handler (Alternative when Paystack is down)
  const handleCashPayment = useCallback(async () => {
    if (!customerInfo.name || !customerInfo.phone) {
      toast.error("Please provide customer name and phone number");
      return;
    }
    if (getTotal() <= 0) {
      toast.error("Invalid payment amount");
      return;
    }
    setProcessing(true);
    try {
      // Create complete POS transaction for cash payment
      const transactionData = {
        booking_number: bookingData?.booking_number || null,
        items: cart.map(item => ({
          product_id: item.type === 'product' ? item.id : null,
          service_id: item.type === 'service' ? item.id : null,
          quantity: item.quantity,
          price: item.price,
          type: item.type
        })),
        customer_info: customerInfo,
        coupon_code: appliedCoupon?.code || null,
        tax: getTaxAmount(),
        payment_reference: generatePOSReference(),
        payment_method: 'bank_transfer_pos',
        payment_status: 'completed'
      };
      // Process the complete transaction
      const transactionResponse = await apiPost(API_ENDPOINTS.POS_CHECKOUT, transactionData);
    
      // Handle different response structures
      const responseData = transactionResponse.data || transactionResponse;
      const isSuccess = transactionResponse.success !== false && responseData;
    
      if (isSuccess) {
        setPaymentConfirmed(true);
      
        // Note: Backend automatically handles booking status updates via payment webhooks
        // No need for manual booking status update here - backend will sync automatically
      
        if (bookingData && bookingData.id) {
          console.log('Payment processed for booking:', bookingData.booking_number);
          // Backend will automatically update booking status via payment confirmation logic
        }
      
        // Show success message
        const transactionNumber = responseData.transaction_number || responseData.id || 'N/A';
        let successMessage = `Bank Transfer/Physical POS payment successful! Transaction ID: ${transactionNumber}`;
      
        if (bookingData) {
          successMessage += `\n\nBooking ${bookingData.booking_number} has been completed.`;
          successMessage += `\nService: ${bookingData.service_names ? bookingData.service_names.join(', ') : 'N/A'}`;
          successMessage += `\nTotal Amount: ₦${formatPrice(getTotal())}`;
        }
      
        handleSuccess(successMessage);
      
      
        // Clear cart and reset state
        setCart([]);
        setAppliedCoupon(null);
        setCouponCode('');
      
        // Receipt modal removed; success already shown via toast and handleSuccess
      
      } else {
        handleError(null, 'Payment processing failed. Please try again.');
      }
    } catch (error) {
      console.error('Error processing Bank Transfer/Physical POS payment:', error);
      handleError(error, 'Error processing Bank Transfer/Physical POS payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [customerInfo, getTotal, bookingData, cart, appliedCoupon, getSubtotal, getDiscount, getTaxAmount, fetchBookingByNumber, handleSuccess, handleError]);
  // Card Payment Handler (using Paystack)
  const handleCardPayment = useCallback(() => {
    // Reuse the existing Paystack payment handler for card payments
    handlePaystackPayment();
  }, [handlePaystackPayment]);
  // Bank Transfer Payment Handler
  const handleTransferPayment = useCallback(async () => {
    if (!customerInfo.name || !customerInfo.phone) {
      toast.error("Please provide customer name and phone number");
      return;
    }
    if (getTotal() <= 0) {
      toast.error("Invalid payment amount");
      return;
    }
    setProcessing(true);
    try {
      // Create complete POS transaction for bank transfer payment
      const transactionData = {
        booking_number: bookingData?.booking_number || null,
        items: cart.map(item => ({
          product_id: item.type === 'product' ? item.id : null,
          service_id: item.type === 'service' ? item.id : null,
          quantity: item.quantity,
          price: item.price,
          type: item.type
        })),
        customer_info: customerInfo,
        coupon_code: appliedCoupon?.code || null,
        tax: getTaxAmount(),
        payment_reference: generateBankTransferReference(),
        payment_method: 'bank_transfer_pos',
        payment_status: 'completed'
      };
      // Process the complete transaction
      const transactionResponse = await apiPost(API_ENDPOINTS.POS_CHECKOUT, transactionData);
    
      // Handle different response structures
      const responseData = transactionResponse.data || transactionResponse;
      const isSuccess = transactionResponse.success !== false && responseData;
    
      if (isSuccess) {
        setPaymentConfirmed(true);
      
        // Backend will handle all booking status updates via webhooks
        // No frontend status updates to prevent conflicts with auto-completion logic
      
        // Show success message
        const transactionNumber = responseData.transaction_number || responseData.id || 'N/A';
        let successMessage = `Bank transfer payment recorded! Transaction ID: ${transactionNumber}`;
      
        if (bookingData) {
          successMessage += `\n\nBooking ${bookingData.booking_number} has been completed.`;
          successMessage += `\nService: ${bookingData.service_names ? bookingData.service_names.join(', ') : 'N/A'}`;
          successMessage += `\nTotal Amount: ₦${formatPrice(getTotal())}`;
          successMessage += `\n\nPlease confirm transfer receipt before completing service.`;
        }
      
        handleSuccess(successMessage);
      
      
        // Clear cart and reset state
        setCart([]);
        setAppliedCoupon(null);
        setCouponCode('');
      
        // Receipt modal removed; success already shown via toast and handleSuccess
      
      } else {
        handleError(null, 'Payment processing failed. Please try again.');
      }
    } catch (error) {
      console.error('Error processing transfer payment:', error);
      handleError(error, 'Error processing transfer payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [customerInfo, getTotal, bookingData, cart, appliedCoupon, getSubtotal, getDiscount, getTaxAmount, fetchBookingByNumber, handleSuccess, handleError]);
  // POS Terminal Payment Handler
  const handlePosTerminalPayment = useCallback(async () => {
    if (!customerInfo.name || !customerInfo.phone) {
      toast.error("Please provide customer name and phone number");
      return;
    }
    if (getTotal() <= 0) {
      toast.error("Invalid payment amount");
      return;
    }
    // Simulate POS terminal processing
    setProcessing(true);
    try {
      // Simulate POS terminal processing delay
      await new Promise(resolve => setTimeout(resolve, 3000));
    
      // Create complete POS transaction for POS terminal payment
      const transactionData = {
        booking_number: bookingData?.booking_number || null,
        items: cart.map(item => ({
          product_id: item.type === 'product' ? item.id : null,
          service_id: item.type === 'service' ? item.id : null,
          quantity: item.quantity,
          price: item.price,
          type: item.type
        })),
        customer_info: customerInfo,
        coupon_code: appliedCoupon?.code || null,
        tax: getTaxAmount(),
        payment_reference: generatePOSReference(),
        payment_method: 'physical_pos',
        payment_status: 'completed'
      };
      // Process the complete transaction
      const transactionResponse = await apiPost(API_ENDPOINTS.POS_CHECKOUT, transactionData);
    
      // Handle different response structures
      const responseData = transactionResponse.data || transactionResponse;
      const isSuccess = transactionResponse.success !== false && responseData;
    
      if (isSuccess) {
        setPaymentConfirmed(true);
      
        // Backend will handle all booking status updates via webhooks
        // No frontend status updates to prevent conflicts with auto-completion logic
      
        // Show success message
        const transactionNumber = responseData.transaction_number || responseData.id || 'N/A';
        let successMessage = `POS Terminal payment successful! Transaction ID: ${transactionNumber}`;
      
        if (bookingData) {
          successMessage += `\n\nBooking ${bookingData.booking_number} has been completed.`;
          successMessage += `\nService: ${bookingData.service_names ? bookingData.service_names.join(', ') : 'N/A'}`;
          successMessage += `\nTotal Amount: ₦${formatPrice(getTotal())}`;
        }
      
        handleSuccess(successMessage);
      
      
        // Clear cart and reset state
        setCart([]);
        setAppliedCoupon(null);
        setCouponCode('');
      
        // Receipt modal removed; success already shown via toast and handleSuccess
      
      } else {
        handleError(null, 'Payment processing failed. Please try again.');
      }
    } catch (error) {
      console.error('Error processing POS terminal payment:', error);
      handleError(error, 'Error processing POS terminal payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [customerInfo, getTotal, bookingData, cart, appliedCoupon, getSubtotal, getDiscount, getTaxAmount, fetchBookingByNumber, handleSuccess, handleError]);
  const handleCheckout = useCallback(async () => {
    if (cart.length === 0 && !bookingData) {
      handleError(null, 'Cart is empty. Please add products or services to continue.');
      return;
    }
    if (!customerInfo.name || !customerInfo.phone) {
      handleError(null, 'Please provide customer name and phone number');
      return;
    }
    
    // Validate inventory availability before checkout
    const inventoryErrors = [];
    cart.forEach(item => {
      if (item.type === 'product') {
        const product = products.find(p => p.id === item.id);
        if (!product) {
          inventoryErrors.push(`Product "${item.name}" not found`);
        } else if (product.stock_level <= 0) {
          inventoryErrors.push(`Product "${item.name}" is out of stock`);
        } else if (item.quantity > product.stock_level) {
          inventoryErrors.push(`Only ${product.stock_level} units available for "${item.name}"`);
        }
      }
    });
    
    if (inventoryErrors.length > 0) {
      handleError(null, `Inventory issues: ${inventoryErrors.join(', ')}`);
      return;
    }
    
    setProcessing(true);
    try {
      const transactionData = {
        booking_number: bookingData?.booking_number || null,
        items: cart.map(item => ({
          product_id: item.type === 'product' ? item.id : null,
          service_id: item.type === 'service' ? item.id : null,
          quantity: item.quantity,
          price: item.price,
          type: item.type
        })),
        customer_info: customerInfo,
        coupon_code: appliedCoupon?.code || null,
        tax: getTaxAmount()
      };
      const response = await apiPost(API_ENDPOINTS.POS_CHECKOUT, transactionData);
    
      // Handle different response structures
      const responseData = response.data || response;
      const transactionNumber = responseData.transaction_number || responseData.id || 'N/A';
    
      let successMessage = `Transaction completed successfully! Transaction ID: ${transactionNumber}`;
     
      if (responseData.booking_updated || response.booking_updated) {
        successMessage += `\n\nBooking ${bookingData.booking_number} has been marked as COMPLETED.`;
        successMessage += `\nService: ${bookingData.service_names ? bookingData.service_names.join(', ') : 'N/A'}`;
        const totalAmount = responseData.total_amount || response.total_amount || getTotal();
        const formattedAmount = formatPrice(totalAmount);
        successMessage += `\nTotal Amount: ₦${formattedAmount}`;
      }
    
      handleSuccess(successMessage);
    
      // Receipt modal removed; success already shown via toast and handleSuccess
    
      // Reset all state after successful checkout
      setCart([]);
      setAppliedCoupon(null);
      setCouponCode('');
      setPaymentConfirmed(false);
      clearBooking();
      fetchProducts();
    
    } catch (error) {
      console.error('Error processing transaction:', error);
      handleError(error, 'Error processing transaction. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [cart, bookingData, customerInfo, appliedCoupon, getSubtotal, getDiscount, getTotal, clearBooking, handleSuccess, handleError, selectedPaymentMethod]);
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading products...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex flex-1 overflow-hidden">
        {/* Main Content - Products/Services */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h1 className="text-3xl font-bold text-gray-900">Point of Sale</h1>
              <p className="text-gray-500 mt-1">Manage sales and transactions</p>
            </div>
            {apiOnline === false && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Server is unreachable. Please start the backend or check your connection.</span>
                  <span className="text-xs">API: {import.meta.env.VITE_API_URL}</span>
                </div>
              </div>
            )}
            {/* Booking Lookup */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Booking Lookup
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter booking number (e.g., BK-JOHN-123)"
                  value={bookingNumber}
                  onChange={(e) => setBookingNumber(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <div className="flex gap-2">
                  <button
                    onClick={fetchBooking}
                    disabled={bookingLoading}
                    className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                  >
                    {bookingLoading ? 'Loading...' : 'Find Booking'}
                  </button>
                  {bookingData && (
                    <button
                      onClick={clearBooking}
                      className="px-4 py-2.5 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            
              {bookingData && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-semibold text-blue-900 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Booking Details
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center">
                      <span className="text-gray-600 font-medium">Customer:</span>
                      <span className="ml-2 text-gray-900">{bookingData.customer_name}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-600 font-medium">Service:</span>
                      <span className="ml-2 text-gray-900">{bookingData.service_names ? bookingData.service_names.join(', ') : bookingData.service_name || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-600 font-medium">Price:</span>
                      <span className="ml-2 text-gray-900 font-semibold">₦{formatPrice(bookingData.service_price || 0)}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-gray-600 font-medium">Status:</span>
                      <span className={`ml-2 px-2.5 py-1 rounded-full text-xs font-medium ${
                        bookingData.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        bookingData.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                        bookingData.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {bookingData.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    {bookingData.payment_status && (
                      <div className="flex items-center">
                        <span className="text-gray-600 font-medium">Payment:</span>
                        <span className={`ml-2 px-2.5 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(bookingData.payment_status)}`}>
                          {bookingData.payment_status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Tab Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('products')}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    activeTab === 'products'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  📦 Products
                </button>
                <button
                  onClick={() => setActiveTab('services')}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    activeTab === 'services'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🔧 Services
                </button>
              </div>
            </div>
            {/* Barcode Scanner */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Barcode Scanner
                </h3>
                <button
                  onClick={toggleScanningMode}
                  className={`px-4 py-2 rounded-lg font-medium transition-all shadow-sm ${
                    scanningMode
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  }`}
                >
                  {scanningMode ? '⏹ Stop Scanning' : '▶ Start Scanning'}
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Scan or enter SKU..."
                  value={skuInput}
                  onChange={handleSkuInput}
                  className={`w-full px-4 py-3 pr-12 border-2 rounded-lg focus:outline-none focus:ring-2 transition ${
                    scanningMode
                      ? 'border-green-300 focus:ring-green-500 bg-green-50'
                      : 'border-gray-300 focus:ring-blue-500 bg-white'
                  }`}
                />
                {scanningMode && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="flex items-center text-green-600">
                      <div className="animate-pulse w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {scanningMode
                  ? '✓ Scanning active - Products will auto-add to cart'
                  : 'Enter SKU to search. Toggle "Start Scanning" for auto-add mode.'
                }
              </p>
            </div>
            {/* Search and Filters */}
            {activeTab === 'products' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="🔍 Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
                  >
                    {categories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {activeTab === 'services' && (
              <div className="space-y-6">
                {/* Services Search and Filter */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="🔍 Search services..."
                      value={serviceSearchTerm}
                      onChange={(e) => setServiceSearchTerm(e.target.value)}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                    <select
                      value={selectedServiceCategory}
                      onChange={(e) => setSelectedServiceCategory(e.target.value)}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
                    >
                      {serviceCategories.map(category => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Services Grid */}
                <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredServices.map(service => (
                    <div
                      key={service.id}
                      onClick={() => addToCart(service, 'service')}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-lg hover:border-purple-300 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition">
                          <span className="text-xl">🔧</span>
                        </div>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                          {service.duration} min
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{service.name}</h3>
                      <p className="text-xs text-gray-500 mb-3">{service.category}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-purple-600">₦{formatPrice(service.price)}</span>
                        <button className="w-8 h-8 bg-purple-600 text-white rounded-lg flex items-center justify-center hover:bg-purple-700 transition">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                      {service.description && (
                        <p className="text-xs text-gray-400 mt-2 line-clamp-2">{service.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Products Grid */}
            {activeTab === 'products' && (
              <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product, 'product')}
                    className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-lg transition-all cursor-pointer group ${
                      product.stock_level <= 0 
                        ? 'border-red-200 opacity-60 cursor-not-allowed' 
                        : product.stock_level <= 5 
                          ? 'border-yellow-200 hover:border-yellow-300' 
                          : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition">
                        <span className="text-xl">📦</span>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        product.stock_level <= 0 
                          ? 'bg-red-100 text-red-700' 
                          : product.stock_level <= 5 
                            ? 'bg-yellow-100 text-yellow-700' 
                            : 'bg-gray-100 text-gray-600'
                      }`}>
                        {product.stock_level <= 0 ? 'Out of Stock' : `${product.stock_level} in stock`}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                    <p className="text-xs text-gray-500 mb-3">{product.sku}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-blue-600">₦{formatPrice(product.price)}</span>
                      <button className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                    {product.description && (
                      <p className="text-xs text-gray-400 mt-2 line-clamp-2">{product.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Cart Sidebar - Desktop */}
        <div className="w-[400px] bg-white border-l border-gray-200 flex-col shadow-xl">
          <div className="p-4 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Shopping Cart
              </h3>
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                {cart.length + (bookingData ? 1 : 0)}
              </span>
            </div>
            {/* Customer Info */}
            <div className="mb-3">
              <h4 className="font-semibold text-gray-700 mb-2 text-sm uppercase tracking-wide">Customer Details</h4>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Customer Name *"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                />
                <input
                  type="tel"
                  placeholder="Phone Number *"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm"
                />
              </div>
            </div>
            {/* Cart Items */}
            <div className={`${cart.length === 0 && !bookingData ? 'flex-initial' : 'flex-1'} overflow-y-auto mb-2 -mx-2 px-2 space-y-2`}>
              {cart.length === 0 && !bookingData ? (
                <div className="text-center py-2">
                  <svg className="w-10 h-10 mx-auto text-gray-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <p className="text-gray-500 font-semibold text-xs">Your cart is empty</p>
                  <p className="text-gray-400 text-xs mt-0.5">Add products or services to get started</p>
                </div>
              ) : (
                <>
                  {/* Service from booking */}
                  {bookingData && (
                    <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center mb-1">
                            <span className="text-lg mr-2">📅</span>
                            <h4 className="font-semibold text-sm text-blue-900 truncate">{bookingData.service_names ? bookingData.service_names.join(', ') : bookingData.service_name || 'N/A'}</h4>
                          </div>
                          <p className="text-xs text-blue-600 font-medium">Booking: {bookingData.booking_number}</p>
                        </div>
                        <div className="ml-3 text-right">
                          <p className="text-sm font-bold text-blue-900">₦{formatPrice(bookingData.service_price || 0)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                
                  {/* Regular cart items */}
                  {cart.map(item => (
                    <div key={`${item.type}-${item.id}`} className="p-2 bg-gray-50 border border-gray-200 rounded-lg hover:border-gray-300 transition">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center mb-1">
                            <span className="text-sm mr-2">{item.type === 'service' ? '🔧' : '📦'}</span>
                            <h4 className="font-semibold text-sm text-gray-900 truncate">{item.name}</h4>
                          </div>
                          <p className="text-xs text-gray-500">₦{formatPrice(item.price)} each</p>
                          {item.type === 'service' && (
                            <p className="text-xs text-purple-600 font-medium">{item.duration} minutes</p>
                          )}
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id, item.type)}
                          className="ml-2 w-6 h-6 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition flex-shrink-0"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center bg-white border border-gray-300 rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1, item.type)}
                            className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 transition text-gray-600"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" />
                            </svg>
                          </button>
                          <span className="w-8 text-center text-sm font-semibold text-gray-900">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1, item.type)}
                            className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 transition text-gray-600"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-sm font-bold text-gray-900">₦{formatPrice(item.price * item.quantity)}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
            {/* Coupon and Payment Section */}
            <div className="space-y-3">
              {/* Coupon Section */}
              <div className="pb-3 border-b border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-sm disabled:bg-gray-100"
                    disabled={!!appliedCoupon}
                  />
                  {appliedCoupon ? (
                    <button
                      onClick={removeCoupon}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium text-sm"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={applyCoupon}
                      className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium text-sm"
                    >
                      Apply
                    </button>
                  )}
                </div>
                {appliedCoupon && (
                  <div className="mt-1 flex items-center text-sm">
                    <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-green-600 font-medium">Coupon "{appliedCoupon.code}" applied!</span>
                  </div>
                )}
              </div>
              {/* Total Section */}
              <div className="space-y-4">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium">₦{formatPrice(getSubtotal())}</span>
                  </div>
                  {appliedCoupon && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span className="font-medium">-₦{formatPrice(getDiscount())}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Tax (7.5%)</span>
                    <span className="font-medium">₦{formatPrice(getTaxAmount())}</span>
                  </div>
                </div>
              
                <div className="pt-2 border-t-2 border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-base font-bold text-gray-900">Total</span>
                    <span className="text-xl font-bold text-blue-600">₦{formatPrice(getTotal())}</span>
                  </div>
                  {/* Payment Method Selection Removed for Simplicity */}
                  {/* Payment Buttons - Restructured for clarity */}
                  {(bookingData || cart.length > 0) && !paymentConfirmed && (
                    <div className="space-y-3">
                      {/* Paystack Online Payment (Primary) */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Online Payment</span>
                        {apiOnline ? (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            Paystack ready
                          </span>
                        ) : (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                            Paystack unavailable
                          </span>
                        )}
                      </div>
                      <button
                        onClick={handlePaystackPayment}
                        disabled={processing || (cart.length === 0 && !bookingData) || !apiOnline}
                        className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-4 focus:ring-green-300 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-lg disabled:shadow-none flex items-center justify-center gap-2 text-center"
                      >
                        {processing ? (
                          <span className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            <span>Processing...</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pay with Paystack (Online)
                          </span>
                        )}
                      </button>
                      
                      {/* Alternative Payment Methods (Bank Transfer / Physical POS) */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-white text-gray-500">or use when Paystack is down</span>
                        </div>
                      </div>
                      
                      {/* Bank Transfer / Physical POS Button */}
                      <button
                        onClick={handleCashPayment}
                        disabled={processing || getTotal() <= 0}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border-2 border-blue-200"
                      >
                        {processing ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                            Processing...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="text-lg">🏦</span>
                            Bank Transfer / Physical POS
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                  {/* Payment Confirmed Badge */}
                  {paymentConfirmed && (
                    <div className="bg-green-100 text-green-800 px-3 py-2 rounded-md font-medium flex items-center justify-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Payment Confirmed
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default POS;