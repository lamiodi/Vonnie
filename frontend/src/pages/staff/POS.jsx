import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { LoadingSpinner, ButtonSpinner } from '../../components/ui/LoadingSpinner'
import { toast } from 'react-hot-toast'
import { formatCurrency, formatDate, formatTime, generateId } from '../../lib/utils'

const POS = () => {
  const { user, profile } = useAuth()
  const [products, setProducts] = useState([])
  const [services, setServices] = useState([])
  const [cart, setCart] = useState([])
  const [customers, setCustomers] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('products') // products, services
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [currentReceipt, setCurrentReceipt] = useState(null)
  
  const [customerForm, setCustomerForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: ''
  })

  const [paymentData, setPaymentData] = useState({
    method: 'cash', // cash, card, transfer, split
    cash_amount: '',
    card_amount: '',
    transfer_amount: '',
    discount_type: 'none', // none, percentage, fixed
    discount_value: '',
    tax_rate: 7.5, // VAT rate
    notes: ''
  })

  // Barcode scanning state
  const [barcodeInput, setBarcodeInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        const mockProducts = [
          {
            id: 1,
            name: 'Hair Relaxer - Professional Grade',
            category: 'Hair Care',
            price: 8500,
            cost: 5000,
            stock: 25,
            barcode: '1234567890123',
            description: 'Professional grade hair relaxer for all hair types',
            image: null,
            is_active: true
          },
          {
            id: 2,
            name: 'Nail Polish - Ruby Red',
            category: 'Nail Care',
            price: 2500,
            cost: 1200,
            stock: 45,
            barcode: '2345678901234',
            description: 'Long-lasting nail polish in ruby red',
            image: null,
            is_active: true
          },
          {
            id: 3,
            name: 'Facial Cleanser - Organic',
            category: 'Skin Care',
            price: 6500,
            cost: 3500,
            stock: 18,
            barcode: '3456789012345',
            description: 'Organic facial cleanser for sensitive skin',
            image: null,
            is_active: true
          },
          {
            id: 4,
            name: 'Hair Shampoo - Moisturizing',
            category: 'Hair Care',
            price: 4500,
            cost: 2500,
            stock: 32,
            barcode: '4567890123456',
            description: 'Deep moisturizing shampoo for dry hair',
            image: null,
            is_active: true
          },
          {
            id: 5,
            name: 'Makeup Foundation - Medium',
            category: 'Makeup',
            price: 12000,
            cost: 7000,
            stock: 15,
            barcode: '5678901234567',
            description: 'Full coverage foundation for medium skin tones',
            image: null,
            is_active: true
          },
          {
            id: 6,
            name: 'Hair Conditioner - Protein Treatment',
            category: 'Hair Care',
            price: 5500,
            cost: 3000,
            stock: 28,
            barcode: '6789012345678',
            description: 'Protein treatment conditioner for damaged hair',
            image: null,
            is_active: true
          },
          {
            id: 7,
            name: 'Nail File Set',
            category: 'Nail Care',
            price: 1500,
            cost: 800,
            stock: 50,
            barcode: '7890123456789',
            description: 'Professional nail file set with different grits',
            image: null,
            is_active: true
          },
          {
            id: 8,
            name: 'Face Mask - Hydrating',
            category: 'Skin Care',
            price: 3500,
            cost: 1800,
            stock: 22,
            barcode: '8901234567890',
            description: 'Hydrating face mask with hyaluronic acid',
            image: null,
            is_active: true
          }
        ]
        
        const mockServices = [
          {
            id: 1,
            name: 'Hair Cut & Style',
            category: 'Hair Services',
            price: 15000,
            duration: 60,
            description: 'Professional hair cutting and styling service',
            is_active: true
          },
          {
            id: 2,
            name: 'Manicure & Pedicure',
            category: 'Nail Services',
            price: 12000,
            duration: 90,
            description: 'Complete manicure and pedicure service',
            is_active: true
          },
          {
            id: 3,
            name: 'Facial Treatment',
            category: 'Skin Services',
            price: 18000,
            duration: 75,
            description: 'Deep cleansing facial with moisturizing treatment',
            is_active: true
          },
          {
            id: 4,
            name: 'Hair Relaxing',
            category: 'Hair Services',
            price: 25000,
            duration: 120,
            description: 'Professional hair relaxing treatment',
            is_active: true
          },
          {
            id: 5,
            name: 'Makeup Application',
            category: 'Makeup Services',
            price: 20000,
            duration: 45,
            description: 'Professional makeup application for events',
            is_active: true
          },
          {
            id: 6,
            name: 'Hair Coloring',
            category: 'Hair Services',
            price: 30000,
            duration: 150,
            description: 'Professional hair coloring service',
            is_active: true
          },
          {
            id: 7,
            name: 'Eyebrow Threading',
            category: 'Beauty Services',
            price: 3000,
            duration: 20,
            description: 'Precise eyebrow shaping with threading',
            is_active: true
          },
          {
            id: 8,
            name: 'Hair Wash & Blow Dry',
            category: 'Hair Services',
            price: 8000,
            duration: 30,
            description: 'Hair washing and professional blow dry',
            is_active: true
          }
        ]
        
        const mockCustomers = [
          {
            id: 1,
            first_name: 'Adunni',
            last_name: 'Okafor',
            email: 'adunni.okafor@email.com',
            phone: '+234 801 234 5678',
            address: '123 Victoria Island, Lagos',
            total_spent: 125000,
            visits: 8,
            last_visit: '2024-01-10',
            loyalty_points: 250
          },
          {
            id: 2,
            first_name: 'Chioma',
            last_name: 'Nwankwo',
            email: 'chioma.nwankwo@email.com',
            phone: '+234 803 456 7890',
            address: '456 Lekki Phase 1, Lagos',
            total_spent: 89000,
            visits: 5,
            last_visit: '2024-01-08',
            loyalty_points: 178
          },
          {
            id: 3,
            first_name: 'Fatima',
            last_name: 'Abdullahi',
            email: 'fatima.abdullahi@email.com',
            phone: '+234 805 678 9012',
            address: '789 Ikeja GRA, Lagos',
            total_spent: 156000,
            visits: 12,
            last_visit: '2024-01-12',
            loyalty_points: 312
          }
        ]
        
        setProducts(mockProducts)
        setServices(mockServices)
        setCustomers(mockCustomers)
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load POS data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const getFilteredItems = () => {
    const items = activeTab === 'products' ? products : services
    let filtered = items.filter(item => item.is_active)

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.barcode && item.barcode.includes(searchTerm))
      )
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter)
    }

    return filtered
  }

  const getCategories = () => {
    const items = activeTab === 'products' ? products : services
    const categories = [...new Set(items.map(item => item.category))]
    return categories
  }

  const addToCart = (item) => {
    const existingItem = cart.find(cartItem => 
      cartItem.id === item.id && cartItem.type === activeTab.slice(0, -1) // remove 's' from 'products'/'services'
    )

    if (existingItem) {
      if (activeTab === 'products') {
        // Check stock for products
        if (existingItem.quantity >= item.stock) {
          toast.error(`Only ${item.stock} units available in stock`)
          return
        }
      }
      
      setCart(prev => prev.map(cartItem =>
        cartItem.id === item.id && cartItem.type === activeTab.slice(0, -1)
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ))
    } else {
      const cartItem = {
        ...item,
        type: activeTab.slice(0, -1), // 'product' or 'service'
        quantity: 1,
        cartId: generateId()
      }
      setCart(prev => [...prev, cartItem])
    }
    
    toast.success(`${item.name} added to cart`)
  }

  const updateCartQuantity = (cartId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(cartId)
      return
    }

    const cartItem = cart.find(item => item.cartId === cartId)
    if (cartItem && cartItem.type === 'product' && newQuantity > cartItem.stock) {
      toast.error(`Only ${cartItem.stock} units available in stock`)
      return
    }

    setCart(prev => prev.map(item =>
      item.cartId === cartId ? { ...item, quantity: newQuantity } : item
    ))
  }

  const removeFromCart = (cartId) => {
    setCart(prev => prev.filter(item => item.cartId !== cartId))
    toast.success('Item removed from cart')
  }

  const clearCart = () => {
    setCart([])
    setSelectedCustomer(null)
    toast.success('Cart cleared')
  }

  // Barcode scanning functionality
  const handleBarcodeInput = (e) => {
    const value = e.target.value
    setBarcodeInput(value)
    
    // Auto-detect when barcode scanning is complete (typically ends with Enter key or timeout)
    if (value.length >= 8) {
      processBarcodeScan(value)
    }
  }

  const processBarcodeScan = (barcode) => {
    // Find product by barcode
    const product = products.find(p => p.barcode === barcode)
    
    if (product) {
      // Check if product is already in cart
      const existingItem = cart.find(item => item.id === product.id && item.type === 'product')
      
      if (existingItem) {
        // Update quantity if already in cart
        updateCartQuantity(existingItem.cartId, existingItem.quantity + 1)
        toast.success(`Added another ${product.name}`)
      } else {
        // Add new product to cart
        addToCart({
          ...product,
          type: 'product',
          cartId: generateId(),
          quantity: 1
        })
        toast.success(`Added ${product.name} to cart`)
      }
      
      // Clear barcode input after successful scan
      setBarcodeInput('')
    } else {
      toast.error('Product not found with this barcode')
    }
  }

  const startBarcodeScan = () => {
    setIsScanning(true)
    setBarcodeInput('')
    toast.info('Ready to scan barcode...')
  }

  const stopBarcodeScan = () => {
    setIsScanning(false)
    setBarcodeInput('')
  }

  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  }

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal()
    if (paymentData.discount_type === 'percentage') {
      return (subtotal * parseFloat(paymentData.discount_value || 0)) / 100
    } else if (paymentData.discount_type === 'fixed') {
      return parseFloat(paymentData.discount_value || 0)
    }
    return 0
  }

  const calculateTax = () => {
    const subtotal = calculateSubtotal()
    const discount = calculateDiscount()
    const taxableAmount = subtotal - discount
    return (taxableAmount * paymentData.tax_rate) / 100
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    const discount = calculateDiscount()
    const tax = calculateTax()
    return subtotal - discount + tax
  }

  const handleCustomerSubmit = async (e) => {
    e.preventDefault()
    setIsProcessing(true)

    try {
      // Validate form
      if (!customerForm.first_name || !customerForm.last_name || !customerForm.phone) {
        toast.error('Please fill in required fields')
        return
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      const newCustomer = {
        ...customerForm,
        id: Date.now(),
        total_spent: 0,
        visits: 0,
        last_visit: null,
        loyalty_points: 0
      }

      setCustomers(prev => [...prev, newCustomer])
      setSelectedCustomer(newCustomer)
      setShowCustomerModal(false)
      setCustomerForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        address: ''
      })
      toast.success('Customer added successfully')
    } catch (error) {
      console.error('Error adding customer:', error)
      toast.error('Failed to add customer')
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePayment = async (e) => {
    e.preventDefault()
    setIsProcessing(true)

    try {
      if (cart.length === 0) {
        toast.error('Cart is empty')
        return
      }

      const total = calculateTotal()
      let totalPaid = 0

      if (paymentData.method === 'cash') {
        totalPaid = parseFloat(paymentData.cash_amount || 0)
      } else if (paymentData.method === 'card') {
        totalPaid = parseFloat(paymentData.card_amount || 0)
      } else if (paymentData.method === 'transfer') {
        totalPaid = parseFloat(paymentData.transfer_amount || 0)
      } else if (paymentData.method === 'split') {
        totalPaid = parseFloat(paymentData.cash_amount || 0) + 
                   parseFloat(paymentData.card_amount || 0) + 
                   parseFloat(paymentData.transfer_amount || 0)
      }

      if (totalPaid < total) {
        toast.error('Insufficient payment amount')
        return
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Create receipt
      const receipt = {
        id: generateId(),
        date: new Date().toISOString(),
        customer: selectedCustomer,
        items: [...cart],
        subtotal: calculateSubtotal(),
        discount: calculateDiscount(),
        tax: calculateTax(),
        total: total,
        payment_method: paymentData.method,
        amount_paid: totalPaid,
        change: totalPaid - total,
        cashier: `${user.first_name} ${user.last_name}`,
        notes: paymentData.notes
      }

      // Update customer data if selected
      if (selectedCustomer) {
        setCustomers(prev => prev.map(customer =>
          customer.id === selectedCustomer.id
            ? {
                ...customer,
                total_spent: customer.total_spent + total,
                visits: customer.visits + 1,
                last_visit: new Date().toISOString().split('T')[0],
                loyalty_points: customer.loyalty_points + Math.floor(total / 100)
              }
            : customer
        ))
      }

      // Update product stock
      const productUpdates = cart.filter(item => item.type === 'product')
      if (productUpdates.length > 0) {
        setProducts(prev => prev.map(product => {
          const cartItem = productUpdates.find(item => item.id === product.id)
          if (cartItem) {
            return { ...product, stock: product.stock - cartItem.quantity }
          }
          return product
        }))
      }

      setCurrentReceipt(receipt)
      setShowPaymentModal(false)
      setShowReceiptModal(true)
      clearCart()
      
      // Reset payment data
      setPaymentData({
        method: 'cash',
        cash_amount: '',
        card_amount: '',
        transfer_amount: '',
        discount_type: 'none',
        discount_value: '',
        tax_rate: 7.5,
        notes: ''
      })

      toast.success('Payment processed successfully')
    } catch (error) {
      console.error('Error processing payment:', error)
      toast.error('Failed to process payment')
    } finally {
      setIsProcessing(false)
    }
  }

  const printReceipt = () => {
    // In a real app, this would integrate with a receipt printer
    window.print()
    toast.success('Receipt sent to printer')
  }

  const filteredItems = getFilteredItems()
  const categories = getCategories()
  const subtotal = calculateSubtotal()
  const discount = calculateDiscount()
  const tax = calculateTax()
  const total = calculateTotal()

  return (
    <DashboardLayout title="Point of Sale">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Point of Sale</h1>
              <p className="mt-2 text-gray-600">Process sales and manage transactions</p>
            </div>
            <div className="mt-4 sm:mt-0 flex space-x-3">
              <button
                onClick={() => setShowCustomerModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Add Customer
              </button>
              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Cart
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Products/Services Section */}
            <div className="lg:col-span-2">
              {/* Tabs */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('products')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'products'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Products
                  </button>
                  <button
                    onClick={() => setActiveTab('services')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === 'services'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Services
                  </button>
                </nav>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Search */}
                  <div className="md:col-span-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder={`Search ${activeTab}...`}
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="all">All Categories</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Items Grid */}
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <LoadingSpinner size="lg" text="Loading items..." />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No {activeTab} found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm || categoryFilter !== 'all'
                      ? 'Try adjusting your search or filter criteria.'
                      : `No ${activeTab} available.`
                    }
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => addToCart(item)}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900 text-sm mb-1">{item.name}</h3>
                          <p className="text-xs text-gray-500 mb-2">{item.category}</p>
                          {activeTab === 'products' && (
                            <p className="text-xs text-gray-600">
                              Stock: <span className={`font-medium ${item.stock < 10 ? 'text-red-600' : 'text-green-600'}`}>
                                {item.stock}
                              </span>
                            </p>
                          )}
                          {activeTab === 'services' && (
                            <p className="text-xs text-gray-600">
                              Duration: {item.duration} mins
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary-600">{formatCurrency(item.price)}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          addToCart(item)
                        }}
                        disabled={activeTab === 'products' && item.stock === 0}
                        className="w-full bg-primary-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {activeTab === 'products' && item.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Section */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Shopping Cart</h2>
                
                {/* Customer Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
                  <select
                    value={selectedCustomer?.id || ''}
                    onChange={(e) => {
                      const customer = customers.find(c => c.id === parseInt(e.target.value))
                      setSelectedCustomer(customer || null)
                    }}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  >
                    <option value="">Walk-in Customer</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.first_name} {customer.last_name} - {customer.phone}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Barcode Scanner */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Barcode Scanner</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={barcodeInput}
                      onChange={handleBarcodeInput}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          processBarcodeScan();
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                      placeholder="Scan barcode or enter manually"
                      ref={barcodeInputRef}
                    />
                    <button
                      onClick={isScanning ? stopBarcodeScan : startBarcodeScan}
                      className={`px-3 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors ${
                        isScanning
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                      }`}
                    >
                      {isScanning ? 'Stop Scan' : 'Start Scan'}
                    </button>
                  </div>
                  {isScanning && (
                    <p className="text-xs text-green-600 mt-1">
                      Scanner active - ready to scan barcodes
                    </p>
                  )}
                </div>

                {/* Cart Items */}
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                  {cart.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-8">Cart is empty</p>
                  ) : (
                    cart.map((item) => (
                      <div key={item.cartId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
                          <p className="text-xs text-gray-500">{formatCurrency(item.price)} each</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateCartQuantity(item.cartId, item.quantity - 1)}
                            className="w-6 h-6 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.cartId, item.quantity + 1)}
                            className="w-6 h-6 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeFromCart(item.cartId)}
                            className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors ml-2"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Cart Summary */}
                {cart.length > 0 && (
                  <>
                    <div className="border-t border-gray-200 pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Discount:</span>
                          <span className="font-medium text-green-600">-{formatCurrency(discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tax ({paymentData.tax_rate}%):</span>
                        <span className="font-medium">{formatCurrency(tax)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                        <span>Total:</span>
                        <span className="text-primary-600">{formatCurrency(total)}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="w-full mt-4 bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                    >
                      Proceed to Payment
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-xl bg-white">
            <form onSubmit={handleCustomerSubmit}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Add New Customer</h3>
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="customer_first_name" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="customer_first_name"
                    value={customerForm.first_name}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, first_name: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="customer_last_name" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="customer_last_name"
                    value={customerForm.last_name}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, last_name: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="customer_phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    id="customer_phone"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="+234 xxx xxx xxxx"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="customer_email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    id="customer_email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, email: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="customer_address" className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    id="customer_address"
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, address: e.target.value }))}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isProcessing ? (
                    <>
                      <ButtonSpinner size="sm" />
                      <span className="ml-2">Adding...</span>
                    </>
                  ) : (
                    'Add Customer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-xl bg-white">
            <form onSubmit={handlePayment}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">Process Payment</h3>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Order Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Order Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span className="text-green-600">-{formatCurrency(discount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax ({paymentData.tax_rate}%):</span>
                    <span>{formatCurrency(tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
                    <span>Total:</span>
                    <span className="text-primary-600">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                  <select
                    value={paymentData.method}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, method: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="transfer">Bank Transfer</option>
                    <option value="split">Split Payment</option>
                  </select>
                </div>

                {/* Discount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Discount Type</label>
                  <select
                    value={paymentData.discount_type}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, discount_type: e.target.value, discount_value: '' }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="none">No Discount</option>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₦)</option>
                  </select>
                </div>

                {/* Discount Value */}
                {paymentData.discount_type !== 'none' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Discount Value {paymentData.discount_type === 'percentage' ? '(%)' : '(₦)'}
                    </label>
                    <input
                      type="number"
                      value={paymentData.discount_value}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, discount_value: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      min="0"
                      max={paymentData.discount_type === 'percentage' ? '100' : undefined}
                      step={paymentData.discount_type === 'percentage' ? '0.1' : '1'}
                    />
                  </div>
                )}

                {/* Payment Amounts */}
                {paymentData.method === 'cash' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Cash Amount *</label>
                    <input
                      type="number"
                      value={paymentData.cash_amount}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, cash_amount: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                )}

                {paymentData.method === 'card' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Card Amount *</label>
                    <input
                      type="number"
                      value={paymentData.card_amount}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, card_amount: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                )}

                {paymentData.method === 'transfer' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Transfer Amount *</label>
                    <input
                      type="number"
                      value={paymentData.transfer_amount}
                      onChange={(e) => setPaymentData(prev => ({ ...prev, transfer_amount: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                )}

                {paymentData.method === 'split' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cash Amount</label>
                      <input
                        type="number"
                        value={paymentData.cash_amount}
                        onChange={(e) => setPaymentData(prev => ({ ...prev, cash_amount: e.target.value }))}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Card Amount</label>
                      <input
                        type="number"
                        value={paymentData.card_amount}
                        onChange={(e) => setPaymentData(prev => ({ ...prev, card_amount: e.target.value }))}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Transfer Amount</label>
                      <input
                        type="number"
                        value={paymentData.transfer_amount}
                        onChange={(e) => setPaymentData(prev => ({ ...prev, transfer_amount: e.target.value }))}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </>
                )}

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Additional notes for this transaction..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isProcessing ? (
                    <>
                      <ButtonSpinner size="sm" />
                      <span className="ml-2">Processing...</span>
                    </>
                  ) : (
                    'Process Payment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceiptModal && currentReceipt && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-md shadow-lg rounded-xl bg-white">
            <div className="text-center mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Payment Successful!</h3>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Receipt */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 text-sm">
              <div className="text-center mb-4">
                <h4 className="font-bold text-lg">Vonne Beauty Salon</h4>
                <p className="text-gray-600">Receipt #{currentReceipt.id}</p>
                <p className="text-gray-600">{formatDate(currentReceipt.date)} {formatTime(currentReceipt.date)}</p>
              </div>

              {currentReceipt.customer && (
                <div className="mb-4 pb-2 border-b border-gray-200">
                  <p><strong>Customer:</strong> {currentReceipt.customer.first_name} {currentReceipt.customer.last_name}</p>
                  <p><strong>Phone:</strong> {currentReceipt.customer.phone}</p>
                </div>
              )}

              <div className="mb-4">
                <p><strong>Cashier:</strong> {currentReceipt.cashier}</p>
              </div>

              <div className="space-y-1 mb-4">
                {currentReceipt.items.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span>{item.name} x{item.quantity}</span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-2 space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(currentReceipt.subtotal)}</span>
                </div>
                {currentReceipt.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>-{formatCurrency(currentReceipt.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>{formatCurrency(currentReceipt.tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-1">
                  <span>Total:</span>
                  <span>{formatCurrency(currentReceipt.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid ({currentReceipt.payment_method}):</span>
                  <span>{formatCurrency(currentReceipt.amount_paid)}</span>
                </div>
                {currentReceipt.change > 0 && (
                  <div className="flex justify-between font-medium">
                    <span>Change:</span>
                    <span>{formatCurrency(currentReceipt.change)}</span>
                  </div>
                )}
              </div>

              {currentReceipt.notes && (
                <div className="mt-4 pt-2 border-t border-gray-200">
                  <p><strong>Notes:</strong> {currentReceipt.notes}</p>
                </div>
              )}

              <div className="text-center mt-4 pt-2 border-t border-gray-200 text-xs text-gray-500">
                <p>Thank you for your business!</p>
                <p>Visit us again soon</p>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={printReceipt}
                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                Print Receipt
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

export default POS