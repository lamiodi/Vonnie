import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { usePaystackPayment } from 'react-paystack';
import { useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import { handleError, handleSuccess } from '../utils/errorHandler';
import { toast } from 'react-hot-toast';
import { apiGet, apiPost, apiPatch, API_ENDPOINTS } from '../utils/api';
import { generatePaystackReference, generateBankTransferReference, generatePOSReference } from '../utils/paymentUtils';
import { useAuth } from '../contexts/AuthContext';

const POS = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  
  // Initialize cart from localStorage
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load cart from local storage', e);
      return [];
    }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState('');
  const [skuInput, setSkuInput] = useState('');
  const [scanningMode, setScanningMode] = useState(false);
  
  // Size Selection Modal State
  const [showSizeModal, setShowSizeModal] = useState(false);
  const [selectedProductForSize, setSelectedProductForSize] = useState(null);

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
  const [apiOnline, setApiOnline] = useState(true);
  const [paystackReference, setPaystackReference] = useState("");
  const [bookingNumber, setBookingNumber] = useState('');
  
  // Initialize bookingData from localStorage
  const [bookingData, setBookingData] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_booking_data');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [bookingLoading, setBookingLoading] = useState(false);
  
  // Initialize customerInfo from localStorage
  const [customerInfo, setCustomerInfo] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_customer_info');
      return saved ? JSON.parse(saved) : { name: '', email: '', phone: '' };
    } catch (e) {
      return { name: '', email: '', phone: '' };
    }
  });

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    if (bookingData) {
      localStorage.setItem('pos_booking_data', JSON.stringify(bookingData));
      // Sync booking number if not set
      if (!bookingNumber && bookingData.booking_number) {
        setBookingNumber(bookingData.booking_number);
      }
    } else {
      localStorage.removeItem('pos_booking_data');
    }
  }, [bookingData]);

  useEffect(() => {
    localStorage.setItem('pos_customer_info', JSON.stringify(customerInfo));
  }, [customerInfo]);

  const [activeTab, setActiveTab] = useState('products');
  const [searchParams, setSearchParams] = useSearchParams();

  // Helper function to format prices without showing .00
  const formatPrice = (price) => {
    const formattedPrice = parseFloat(price).toFixed(2);
    if (formattedPrice.endsWith('.00')) {
      return formattedPrice.substring(0, formattedPrice.length - 3);
    }
    return formattedPrice;
  };

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === '' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const matchesSearch = service.name.toLowerCase().includes(serviceSearchTerm.toLowerCase());
      const matchesCategory = selectedServiceCategory === '' || service.category === selectedServiceCategory;
      return matchesSearch && matchesCategory;
    });
  }, [services, serviceSearchTerm, selectedServiceCategory]);
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
  
  // ==========================================
  // CART MANAGEMENT LOGIC
  // ==========================================

  // Memoize calculations to improve performance
  const getSubtotal = useCallback(() => {
    const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    // Include service price from loaded booking if applicable
    const serviceTotal = bookingData ? parseFloat(bookingData.service_price || 0) : 0;
    return cartTotal + serviceTotal;
  }, [cart, bookingData]);

  // Calculate discount based on coupon type (percentage vs fixed)
  const getDiscount = useCallback(() => {
    if (!appliedCoupon) return 0;
  
    const subtotal = getSubtotal();
    if (appliedCoupon.discount_type === 'percentage') {
      return (subtotal * appliedCoupon.discount_value) / 100;
    } else {
      return Math.min(appliedCoupon.discount_value, subtotal);
    }
  }, [appliedCoupon, getSubtotal]);

  // Tax Calculation (VAT)
  const getTaxAmount = useCallback(() => {
    return 0; // VAT temporarily disabled per business requirement
  }, []);

  // Calculate Grand Total
  const getTotal = useCallback(() => {
    const subtotal = getSubtotal();
    const discount = getDiscount();
    return subtotal - discount; // Tax removed from total calculation
  }, [getSubtotal, getDiscount]);

  // Add item to cart (handles both products and services)
  const addToCart = useCallback((item, type = 'product', size = null) => {
    // Reset payment confirmation when adding new items
    if (paymentConfirmed) {
      setPaymentConfirmed(false);
    }
  
    // Check if product has sizes and no size is selected yet
    if (type === 'product' && !size && item.stock_by_size && Object.keys(item.stock_by_size).length > 0) {
      setSelectedProductForSize(item);
      setShowSizeModal(true);
      return;
    }

    const cartItemId = size ? `${item.id}-${size}` : item.id;
    const existingItem = cart.find(cartItem => cartItem.cartItemId === cartItemId && cartItem.type === type);
  
    if (type === 'service') {
      // Services can be added multiple times (quantity increases)
      if (existingItem) {
        setCart(cart.map(cartItem =>
          cartItem.cartItemId === cartItemId && cartItem.type === type
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        ));
      } else {
        setCart([...cart, { ...item, quantity: 1, type: 'service', cartItemId: item.id }]);
      }
    } else {
      // Product logic: Check stock levels before adding
      let availableStock = item.stock_level;
      
      if (size) {
        availableStock = item.stock_by_size[size] || 0;
      }

      if (availableStock <= 0) {
        handleError(null, `Product "${item.name}" ${size ? `(Size ${size})` : ''} is out of stock`);
        return;
      }
      
      if (existingItem) {
        if (existingItem.quantity < availableStock) {
          setCart(cart.map(cartItem =>
            cartItem.cartItemId === cartItemId && cartItem.type === type
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          ));
        } else {
          handleError(null, 'Not enough stock available');
        }
      } else {
        setCart([...cart, { ...item, quantity: 1, type: 'product', size, cartItemId }]);
      }
    }
  }, [cart, paymentConfirmed]);

  const updateQuantity = useCallback((cartItemId, newQuantity, itemType = 'product') => {
    if (newQuantity === 0) {
      removeFromCart(cartItemId, itemType);
      return;
    }
    
    setCart(cart.map(item => {
      if (item.cartItemId === cartItemId && item.type === itemType) {
        if (itemType === 'product') {
           const product = products.find(p => p.id === item.id);
           let availableStock = product.stock_level;
           if (item.size && product.stock_by_size) {
             availableStock = product.stock_by_size[item.size] || 0;
           }
           
           if (newQuantity > availableStock) {
             handleError(null, 'Not enough stock available');
             return item;
           }
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  }, [cart, products]);

  const updateItemPrice = useCallback((cartItemId, newPrice, itemType) => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) {
      handleError(null, 'Invalid price');
      return;
    }
    
    setCart(cart.map(item => 
      (item.cartItemId === cartItemId && item.type === itemType)
        ? { ...item, price: price }
        : item
    ));
  }, [cart]);

  const removeFromCart = useCallback((cartItemId, itemType = 'product') => {
    setCart(cart.filter(item => !(item.cartItemId === cartItemId && item.type === itemType)));
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
  // ==========================================
  // PAYMENT HANDLERS
  // ==========================================

  // Paystack Payment Function - Manager-operated workflow
  // This function initiates the Paystack popup for online card payments
  const handlePaystackPayment = useCallback(() => {
    if (!customerInfo.name || !customerInfo.phone) {
      toast.error("Please provide customer name and phone number");
      return;
    }
    if (getTotal() <= 0) {
      toast.error("Invalid payment amount");
      return;
    }
    // Manager processes payment - use authenticated user's email for Paystack
    const managerEmail = user?.email || "manager@vonniesalon.com"; // Fallback to hardcoded if no user email
  
    const config = {
      reference: generatePaystackReference(), // Generate unique reference
      email: managerEmail,
      amount: Math.round(getTotal() * 100), // Convert to kobo (Paystack expects smallest currency unit)
      publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      currency: "NGN",
      channels: ["card", "bank", "ussd", "qr", "mobile_money"],
      metadata: {
        // Metadata for backend verification and webhooks
        booking_id: bookingData?.id,
        processed_by_user_id: user?.id,
        processed_by_email: managerEmail,
        processed_by_name: user?.name || user?.email,
        custom_fields: [
          {
            display_name: "Customer Name",
            variable_name: "customer_name",
            value: customerInfo.name
          },
          // ... other metadata fields

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
            value: user?.name || user?.email || "Manager"
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
          staff_id: user?.id,
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
        staff_id: user?.id,
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
        staff_id: user?.id,
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
        staff_id: user?.id,
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
        staff_id: user?.id,
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

  // Socket.IO Integration for Real-time Payment Updates
  const bookingIdRef = useRef(null);
  
  useEffect(() => {
    bookingIdRef.current = bookingData?.id;
  }, [bookingData]);

  useEffect(() => {
    // Determine socket URL from env or default
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5010/api';
    // Remove /api from the end to get the root URL
    const SOCKET_URL = API_URL.replace(/\/api$/, '');
    
    console.log('🔌 Connecting to socket server at:', SOCKET_URL);
    const socket = io(SOCKET_URL);
    
    socket.on('connect', () => {
      console.log('✅ Connected to socket server');
    });

    socket.on('payment-verified', (data) => {
      console.log('💰 Payment verified event received:', data);
      
      // Check if this payment matches the current booking
      // We use ref to access the latest booking ID without re-running effect
      if (bookingIdRef.current && data.booking_id === bookingIdRef.current) {
        if (data.success) {
          handleSuccess(`Payment verified via Webhook! Reference: ${data.reference}`);
          setPaymentConfirmed(true);
          setPaystackReference(data.reference);
          
          // Clear cart and reset state as requested
          setCart([]);
          setAppliedCoupon(null);
          setCouponCode('');
          clearBooking();
          fetchProducts(); // Refresh stock levels
        }
      }
    });

    socket.on('payment-failed', (data) => {
       if (bookingIdRef.current && data.booking_id === bookingIdRef.current) {
         handleError(null, `Payment failed via Webhook. Reference: ${data.reference}`);
       }
    });

    return () => {
      socket.off('payment-verified');
      socket.off('payment-failed');
      socket.disconnect();
    };
  }, []);

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

  // REFACTORED: 2-Column Layout
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      {/* LEFT PANEL: CATALOG & SELECTION */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
         {/* Top Header Bar */}
         <div className="bg-white p-4 shadow-sm z-10 flex flex-col gap-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
               <div>
                 <h1 className="text-2xl font-bold text-gray-800">POS Terminal</h1>
                 <p className="text-xs text-gray-500">
                    {apiOnline ? <span className="text-green-600">● Online</span> : <span className="text-red-600">● Offline</span>}
                 </p>
               </div>
               
               {/* Tab Switcher */}
               <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                  <button 
                    onClick={() => setActiveTab('products')} 
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'products' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    📦 Products
                  </button>
                  <button 
                    onClick={() => setActiveTab('services')} 
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'services' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    🔧 Services
                  </button>
               </div>
            </div>
            
            {/* Search & Filters Row */}
            <div className="flex gap-3">
               <div className="flex-1 relative">
                  <input 
                    type="text" 
                    placeholder={activeTab === 'products' ? "Search products (Name/SKU)..." : "Search services..."}
                    value={activeTab === 'products' ? searchTerm : serviceSearchTerm}
                    onChange={(e) => activeTab === 'products' ? setSearchTerm(e.target.value) : setServiceSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  />
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
               </div>
               
               {/* Category Filter */}
               <select 
                  value={activeTab === 'products' ? selectedCategory : selectedServiceCategory}
                  onChange={(e) => activeTab === 'products' ? setSelectedCategory(e.target.value) : setSelectedServiceCategory(e.target.value)}
                  className="w-48 px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 shadow-sm"
               >
                  {(activeTab === 'products' ? categories : serviceCategories).map(c => (
                     <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
               </select>

               {/* Scan Toggle (Small) */}
               <button 
                  onClick={toggleScanningMode}
                  className={`px-3 py-2 rounded-lg border shadow-sm transition-all ${scanningMode ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  title="Toggle Barcode Scanner"
               >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
               </button>
            </div>
            
            {/* Scanner Input (Conditional) */}
            {scanningMode && (
               <div className="relative animate-fadeIn">
                 <input 
                   autoFocus
                   type="text"
                   placeholder="Scan barcode here..."
                   value={skuInput}
                   onChange={handleSkuInput}
                   className="w-full px-3 py-2 pl-10 bg-green-50 border border-green-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                 />
                 <span className="absolute left-3 top-2.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                 </span>
               </div>
            )}
         </div>

         {/* Content Grid */}
         <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {/* Booking Lookup (Collapsible or Banner) */}
            <div className="mb-4 bg-white p-3 rounded-lg shadow-sm border border-blue-100">
               <div className="flex gap-2 items-center">
                  <div className="text-blue-500 mr-2">
                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <input 
                     type="text" 
                     placeholder="Load Booking (e.g., BK-123)..." 
                     value={bookingNumber}
                     onChange={(e) => setBookingNumber(e.target.value.toUpperCase())}
                     className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                  />
                  <button onClick={fetchBooking} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 shadow-sm disabled:opacity-50" disabled={bookingLoading}>
                     {bookingLoading ? 'Loading...' : 'Load Booking'}
                  </button>
               </div>
               {bookingData && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm flex justify-between items-center animate-fadeIn">
                     <div className="flex items-center gap-3">
                        <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs font-bold">ACTIVE</span>
                        <div className="flex flex-col">
                           <span className="font-bold text-gray-800">{bookingData.customer_name}</span>
                           <span className="text-gray-600 text-xs">{bookingData.service_names ? bookingData.service_names.join(', ') : bookingData.service_name}</span>
                        </div>
                     </div>
                     <button onClick={clearBooking} className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 hover:bg-red-50 rounded transition-colors">
                        Clear Selection
                     </button>
                  </div>
               )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
               {activeTab === 'products' ? (
                  filteredProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => addToCart(product, 'product')}
                      className={`bg-white rounded-xl shadow-sm border p-4 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden ${
                        product.stock_level <= 0 
                          ? 'border-red-200 opacity-60 cursor-not-allowed' 
                          : product.stock_level <= 5 
                            ? 'border-yellow-200 hover:border-yellow-300' 
                            : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-xl">📦</div>
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${
                          product.stock_level <= 0 ? 'bg-red-100 text-red-700' : product.stock_level <= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {product.stock_level <= 0 ? 'Out' : product.stock_level}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2 min-h-[40px]">{product.name}</h3>
                      <p className="text-xs text-gray-400 mb-2">{product.sku}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-lg font-bold text-blue-600">₦{formatPrice(product.price)}</span>
                        <button className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition shadow-sm">
                          +
                        </button>
                      </div>
                    </div>
                  ))
               ) : (
                  filteredServices.map(service => (
                    <div
                      key={service.id}
                      onClick={() => addToCart(service, 'service')}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-lg hover:border-purple-300 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-xl">🔧</div>
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                          {service.duration}m
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2 min-h-[40px]">{service.name}</h3>
                      <p className="text-xs text-gray-400 mb-2">{service.category}</p>
                      <div className="flex items-center justify-between mt-auto">
                        <span className="text-lg font-bold text-purple-600">₦{formatPrice(service.price)}</span>
                        <button className="w-8 h-8 bg-purple-600 text-white rounded-lg flex items-center justify-center hover:bg-purple-700 transition shadow-sm">
                          +
                        </button>
                      </div>
                    </div>
                  ))
               )}
            </div>
         </div>
      </div>

      {/* RIGHT PANEL: CART & CHECKOUT */}
      <div className="w-[400px] min-w-[350px] bg-white shadow-2xl flex flex-col border-l border-gray-200 z-20 h-full">
         {/* Customer Header */}
         <div className="p-4 bg-gray-900 text-white shadow-md">
            <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
               Customer Details
            </h2>
            <div className="space-y-2">
               <input 
                 type="text" 
                 placeholder="Customer Name *" 
                 value={customerInfo.name} 
                 onChange={e => setCustomerInfo({...customerInfo, name: e.target.value})} 
                 className="w-full px-3 py-2 text-sm text-white placeholder-gray-400 rounded bg-gray-800 border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
               />
               <input 
                 type="tel" 
                 placeholder="Phone Number *" 
                 value={customerInfo.phone} 
                 onChange={e => setCustomerInfo({...customerInfo, phone: e.target.value})} 
                 className="w-full px-3 py-2 text-sm text-white placeholder-gray-400 rounded bg-gray-800 border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
               />
            </div>
         </div>

         {/* Cart Items List */}
         <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {cart.length === 0 && !bookingData ? (
               <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                  <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                  <p className="font-medium">Cart is empty</p>
               </div>
            ) : (
               <>
                 {/* Booking Item */}
                 {bookingData && (
                    <div className="p-3 bg-white border border-blue-200 rounded-lg shadow-sm relative overflow-hidden group">
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                       <div className="flex justify-between items-start pl-2">
                          <div>
                             <h4 className="font-bold text-gray-800 text-sm">{bookingData.service_names ? bookingData.service_names.join(', ') : bookingData.service_name}</h4>
                             <p className="text-xs text-blue-600 font-medium">Booking #{bookingData.booking_number}</p>
                          </div>
                          <span className="font-bold text-blue-700">₦{formatPrice(bookingData.service_price || 0)}</span>
                       </div>
                    </div>
                 )}
                 
                 {/* Cart Items */}
                 {cart.map((item, index) => (
                    <div key={`${item.id}-${index}`} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col gap-2 group hover:border-gray-300 transition">
                       <div className="flex justify-between items-start">
                          <div>
                             <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{item.name}</h4>
                             <p className="text-xs text-gray-500">{item.size ? `Size: ${item.size}` : item.type === 'service' ? 'Service' : 'Product'}</p>
                          </div>
                          <button onClick={() => removeFromCart(item.cartItemId || item.id, item.type)} className="text-gray-400 hover:text-red-500 transition">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                       </div>
                       
                       <div className="flex justify-between items-center pt-1 border-t border-gray-100 mt-1">
                          <div className="flex items-center border border-gray-200 rounded-md bg-gray-50">
                             <button onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity - 1, item.type)} className="px-2 py-0.5 hover:bg-gray-200 text-gray-600">-</button>
                             <span className="px-2 text-sm font-medium text-gray-900 bg-white border-x border-gray-200">{item.quantity}</span>
                             <button onClick={() => updateQuantity(item.cartItemId || item.id, item.quantity + 1, item.type)} className="px-2 py-0.5 hover:bg-gray-200 text-gray-600">+</button>
                          </div>
                          <span className="font-bold text-gray-900">₦{formatPrice(item.price * item.quantity)}</span>
                       </div>
                    </div>
                 ))}
               </>
            )}
         </div>

         {/* Footer: Totals & Actions */}
         <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30">
            {/* Coupon */}
            <div className="flex gap-2 mb-4">
               <input 
                 type="text" 
                 placeholder="Coupon Code" 
                 value={couponCode}
                 onChange={e => setCouponCode(e.target.value)}
                 disabled={!!appliedCoupon}
                 className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" 
               />
               {appliedCoupon ? (
                 <button onClick={removeCoupon} className="px-3 py-2 bg-red-100 text-red-700 text-xs font-bold rounded-md hover:bg-red-200">REMOVE</button>
               ) : (
                 <button onClick={applyCoupon} className="px-3 py-2 bg-gray-800 text-white text-xs font-bold rounded-md hover:bg-gray-700">APPLY</button>
               )}
            </div>
            
            {/* Totals */}
            <div className="space-y-2 mb-4 text-sm">
               <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₦{formatPrice(getSubtotal())}</span></div>
               {appliedCoupon && (
                 <div className="flex justify-between text-green-600"><span>Discount</span><span>-₦{formatPrice(getDiscount())}</span></div>
               )}
               <div className="flex justify-between font-bold text-xl text-gray-900 border-t border-dashed border-gray-300 pt-3 mt-2">
                  <span>Total</span>
                  <span>₦{formatPrice(getTotal())}</span>
               </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
               <button 
                 onClick={handleCashPayment} 
                 disabled={processing || getTotal() <= 0}
                 className="col-span-1 bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 py-3 rounded-lg font-bold text-sm transition-colors flex flex-col items-center justify-center disabled:opacity-50"
               >
                  <span>CASH / POS</span>
                  <span className="text-[10px] font-normal text-gray-500">Offline Payment</span>
               </button>
               <button 
                 onClick={handlePaystackPayment} 
                 disabled={processing || getTotal() <= 0 || !apiOnline}
                 className="col-span-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold text-sm transition-colors shadow-md flex flex-col items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
               >
                  {processing ? (
                     <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  ) : (
                     <>
                        <span>PAY ONLINE</span>
                        <span className="text-[10px] font-normal opacity-80">Via Paystack</span>
                     </>
                  )}
               </button>
            </div>
         </div>
      </div>
      
      {/* Size Selection Modal */}
      {showSizeModal && selectedProductForSize && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-fadeInScale">
            <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">Select Size</h3>
            <p className="text-center text-gray-500 text-sm mb-6">{selectedProductForSize.name}</p>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              {Object.entries(selectedProductForSize.stock_by_size || {})
                .filter(([_, stock]) => stock > 0)
                .map(([size, stock]) => (
                <button
                  key={size}
                  onClick={() => {
                    addToCart(selectedProductForSize, 'product', size);
                    setShowSizeModal(false);
                    setSelectedProductForSize(null);
                  }}
                  className="flex flex-col items-center justify-center p-4 border-2 border-gray-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <span className="text-xl font-bold text-gray-800 group-hover:text-blue-700">{size}</span>
                  <span className="text-xs text-gray-500 mt-1">{stock} left</span>
                </button>
              ))}
            </div>
            
            <button
              onClick={() => {
                setShowSizeModal(false);
                setSelectedProductForSize(null);
              }}
              className="w-full py-3 text-gray-600 hover:text-gray-900 font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
