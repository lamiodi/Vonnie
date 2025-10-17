import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { LoadingSpinner, ButtonSpinner } from '../../components/ui/LoadingSpinner'
import { toast } from 'react-hot-toast'
import { formatCurrency, generateBarcode } from '../../lib/utils'

const Inventory = () => {
  const { user, profile } = useAuth()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [stockProduct, setStockProduct] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [stockFilter, setStockFilter] = useState('all') // all, low, out
  const [sortBy, setSortBy] = useState('name')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    supplier_id: '',
    sku: '',
    barcode: '',
    cost_price: '',
    selling_price: '',
    current_stock: '',
    minimum_stock: '',
    maximum_stock: '',
    unit: '',
    location: '',
    expiry_date: '',
    is_active: true
  })

  const [stockData, setStockData] = useState({
    quantity: '',
    type: 'in', // in, out, adjustment
    reason: '',
    notes: ''
  })

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        const mockCategories = [
          { id: 1, name: 'Hair Products', description: 'Shampoos, conditioners, treatments' },
          { id: 2, name: 'Nail Products', description: 'Polishes, tools, treatments' },
          { id: 3, name: 'Skin Care', description: 'Cleansers, moisturizers, serums' },
          { id: 4, name: 'Makeup', description: 'Cosmetics and beauty products' },
          { id: 5, name: 'Tools & Equipment', description: 'Professional tools and equipment' },
          { id: 6, name: 'Accessories', description: 'Beauty accessories and supplies' }
        ]
        
        const mockSuppliers = [
          { id: 1, name: 'Beauty Supply Co.', contact: '+234 801 234 5678' },
          { id: 2, name: 'Professional Products Ltd.', contact: '+234 802 345 6789' },
          { id: 3, name: 'Cosmetic Distributors', contact: '+234 803 456 7890' },
          { id: 4, name: 'Hair Care Specialists', contact: '+234 804 567 8901' }
        ]
        
        const mockProducts = [
          {
            id: 1,
            name: 'Premium Shampoo',
            description: 'Professional grade moisturizing shampoo',
            category: 'Hair Products',
            category_id: 1,
            supplier: 'Beauty Supply Co.',
            supplier_id: 1,
            sku: 'SHP001',
            barcode: '1234567890123',
            cost_price: 15000,
            selling_price: 25000,
            current_stock: 45,
            minimum_stock: 10,
            maximum_stock: 100,
            unit: 'bottle',
            location: 'Shelf A1',
            expiry_date: '2025-06-30',
            is_active: true,
            last_restocked: '2024-01-10T00:00:00Z',
            total_sold: 156
          },
          {
            id: 2,
            name: 'Nail Polish Set',
            description: 'Professional nail polish collection',
            category: 'Nail Products',
            category_id: 2,
            supplier: 'Professional Products Ltd.',
            supplier_id: 2,
            sku: 'NPL002',
            barcode: '2345678901234',
            cost_price: 8000,
            selling_price: 15000,
            current_stock: 23,
            minimum_stock: 15,
            maximum_stock: 50,
            unit: 'set',
            location: 'Shelf B2',
            expiry_date: null,
            is_active: true,
            last_restocked: '2024-01-08T00:00:00Z',
            total_sold: 89
          },
          {
            id: 3,
            name: 'Facial Cleanser',
            description: 'Gentle daily facial cleanser',
            category: 'Skin Care',
            category_id: 3,
            supplier: 'Cosmetic Distributors',
            supplier_id: 3,
            sku: 'FCL003',
            barcode: '3456789012345',
            cost_price: 12000,
            selling_price: 20000,
            current_stock: 8,
            minimum_stock: 12,
            maximum_stock: 60,
            unit: 'bottle',
            location: 'Shelf C1',
            expiry_date: '2024-12-31',
            is_active: true,
            last_restocked: '2024-01-05T00:00:00Z',
            total_sold: 67
          },
          {
            id: 4,
            name: 'Professional Hair Dryer',
            description: 'High-performance salon hair dryer',
            category: 'Tools & Equipment',
            category_id: 5,
            supplier: 'Hair Care Specialists',
            supplier_id: 4,
            sku: 'HDR004',
            barcode: '4567890123456',
            cost_price: 85000,
            selling_price: 150000,
            current_stock: 3,
            minimum_stock: 2,
            maximum_stock: 10,
            unit: 'piece',
            location: 'Storage Room',
            expiry_date: null,
            is_active: true,
            last_restocked: '2024-01-12T00:00:00Z',
            total_sold: 12
          },
          {
            id: 5,
            name: 'Lipstick Collection',
            description: 'Premium lipstick collection',
            category: 'Makeup',
            category_id: 4,
            supplier: 'Cosmetic Distributors',
            supplier_id: 3,
            sku: 'LIP005',
            barcode: '5678901234567',
            cost_price: 6000,
            selling_price: 12000,
            current_stock: 0,
            minimum_stock: 20,
            maximum_stock: 80,
            unit: 'piece',
            location: 'Shelf D3',
            expiry_date: '2025-03-31',
            is_active: true,
            last_restocked: '2024-01-01T00:00:00Z',
            total_sold: 234
          },
          {
            id: 6,
            name: 'Hair Conditioning Mask',
            description: 'Deep conditioning treatment mask',
            category: 'Hair Products',
            category_id: 1,
            supplier: 'Beauty Supply Co.',
            supplier_id: 1,
            sku: 'HCM006',
            barcode: '6789012345678',
            cost_price: 18000,
            selling_price: 30000,
            current_stock: 67,
            minimum_stock: 15,
            maximum_stock: 80,
            unit: 'jar',
            location: 'Shelf A2',
            expiry_date: '2024-09-30',
            is_active: true,
            last_restocked: '2024-01-14T00:00:00Z',
            total_sold: 78
          }
        ]
        
        setCategories(mockCategories)
        setSuppliers(mockSuppliers)
        setProducts(mockProducts)
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load inventory data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const getFilteredProducts = () => {
    let filtered = products

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode.includes(searchTerm)
      )
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category_id === parseInt(selectedCategory))
    }

    // Filter by stock level
    if (stockFilter !== 'all') {
      filtered = filtered.filter(product => {
        if (stockFilter === 'low') {
          return product.current_stock <= product.minimum_stock && product.current_stock > 0
        } else if (stockFilter === 'out') {
          return product.current_stock === 0
        }
        return true
      })
    }

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'stock':
          return a.current_stock - b.current_stock
        case 'price':
          return a.selling_price - b.selling_price
        case 'category':
          return a.category.localeCompare(b.category)
        default:
          return 0
      }
    })

    return filtered
  }

  const getStockStatus = (product) => {
    if (product.current_stock === 0) {
      return { status: 'out', color: 'bg-red-100 text-red-800', label: 'Out of Stock' }
    } else if (product.current_stock <= product.minimum_stock) {
      return { status: 'low', color: 'bg-yellow-100 text-yellow-800', label: 'Low Stock' }
    } else {
      return { status: 'good', color: 'bg-green-100 text-green-800', label: 'In Stock' }
    }
  }

  const handleAddProduct = () => {
    setEditingProduct(null)
    setFormData({
      name: '',
      description: '',
      category_id: '',
      supplier_id: '',
      sku: '',
      barcode: '',
      cost_price: '',
      selling_price: '',
      current_stock: '',
      minimum_stock: '',
      maximum_stock: '',
      unit: '',
      location: '',
      expiry_date: '',
      is_active: true
    })
    setShowModal(true)
  }

  const handleEditProduct = (product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description,
      category_id: product.category_id.toString(),
      supplier_id: product.supplier_id.toString(),
      sku: product.sku,
      barcode: product.barcode,
      cost_price: product.cost_price.toString(),
      selling_price: product.selling_price.toString(),
      current_stock: product.current_stock.toString(),
      minimum_stock: product.minimum_stock.toString(),
      maximum_stock: product.maximum_stock.toString(),
      unit: product.unit,
      location: product.location,
      expiry_date: product.expiry_date || '',
      is_active: product.is_active
    })
    setShowModal(true)
  }

  const handleStockUpdate = (product) => {
    setStockProduct(product)
    setStockData({
      quantity: '',
      type: 'in',
      reason: '',
      notes: ''
    })
    setShowStockModal(true)
  }

  const generateSKU = () => {
    const category = categories.find(c => c.id === parseInt(formData.category_id))
    if (category) {
      const prefix = category.name.substring(0, 3).toUpperCase()
      const number = String(products.length + 1).padStart(3, '0')
      setFormData(prev => ({ ...prev, sku: `${prefix}${number}` }))
    }
  }

  const generateBarcodeNumber = () => {
    const barcode = generateBarcode()
    setFormData(prev => ({ ...prev, barcode }))
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validate form
      if (!formData.name || !formData.category_id || !formData.sku || !formData.cost_price || !formData.selling_price) {
        toast.error('Please fill in all required fields')
        return
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      const category = categories.find(c => c.id === parseInt(formData.category_id))
      const supplier = suppliers.find(s => s.id === parseInt(formData.supplier_id))

      const productData = {
        ...formData,
        category_id: parseInt(formData.category_id),
        supplier_id: parseInt(formData.supplier_id),
        cost_price: parseInt(formData.cost_price),
        selling_price: parseInt(formData.selling_price),
        current_stock: parseInt(formData.current_stock) || 0,
        minimum_stock: parseInt(formData.minimum_stock) || 0,
        maximum_stock: parseInt(formData.maximum_stock) || 0,
        category: category?.name || '',
        supplier: supplier?.name || '',
        id: editingProduct ? editingProduct.id : Date.now(),
        last_restocked: editingProduct ? editingProduct.last_restocked : new Date().toISOString(),
        total_sold: editingProduct ? editingProduct.total_sold : 0
      }

      if (editingProduct) {
        // Update existing product
        setProducts(prev => prev.map(product => 
          product.id === editingProduct.id ? productData : product
        ))
        toast.success('Product updated successfully')
      } else {
        // Add new product
        setProducts(prev => [...prev, productData])
        toast.success('Product added successfully')
      }

      setShowModal(false)
    } catch (error) {
      console.error('Error saving product:', error)
      toast.error('Failed to save product. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStockSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (!stockData.quantity || !stockData.reason) {
        toast.error('Please fill in quantity and reason')
        return
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))

      const quantity = parseInt(stockData.quantity)
      let newStock = stockProduct.current_stock

      if (stockData.type === 'in') {
        newStock += quantity
      } else if (stockData.type === 'out') {
        newStock = Math.max(0, newStock - quantity)
      } else if (stockData.type === 'adjustment') {
        newStock = quantity
      }

      // Update product stock
      setProducts(prev => prev.map(product => 
        product.id === stockProduct.id 
          ? { ...product, current_stock: newStock, last_restocked: new Date().toISOString() }
          : product
      ))

      toast.success('Stock updated successfully')
      setShowStockModal(false)
    } catch (error) {
      console.error('Error updating stock:', error)
      toast.error('Failed to update stock. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setProducts(prev => prev.filter(p => p.id !== product.id))
      toast.success('Product deleted successfully')
    } catch (error) {
      console.error('Error deleting product:', error)
      toast.error('Failed to delete product')
    }
  }

  const filteredProducts = getFilteredProducts()
  const lowStockCount = products.filter(p => p.current_stock <= p.minimum_stock && p.current_stock > 0).length
  const outOfStockCount = products.filter(p => p.current_stock === 0).length
  const totalValue = products.reduce((sum, p) => sum + (p.current_stock * p.cost_price), 0)

  return (
    <DashboardLayout title="Inventory Management">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
              <p className="mt-2 text-gray-600">Track and manage your product inventory</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <button
                onClick={handleAddProduct}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add New Product
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900">{products.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Low Stock</p>
                  <p className="text-2xl font-bold text-yellow-600">{lowStockCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalValue)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Search */}
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search Products
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Search by name, SKU, or barcode..."
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
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  id="category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>

              {/* Stock Filter */}
              <div>
                <label htmlFor="stock" className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Status
                </label>
                <select
                  id="stock"
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="all">All Stock Levels</option>
                  <option value="low">Low Stock</option>
                  <option value="out">Out of Stock</option>
                </select>
              </div>

              {/* Sort By */}
              <div>
                <label htmlFor="sort" className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <select
                  id="sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="name">Name</option>
                  <option value="stock">Stock Level</option>
                  <option value="price">Price</option>
                  <option value="category">Category</option>
                </select>
              </div>

              {/* Results Count */}
              <div className="flex items-end">
                <div className="text-sm text-gray-600">
                  <p>Showing: {filteredProducts.length} of {products.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Products Table */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner size="lg" text="Loading inventory..." />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No products found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || selectedCategory !== 'all' || stockFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by adding your first product.'
                }
              </p>
              {!searchTerm && selectedCategory === 'all' && stockFilter === 'all' && (
                <div className="mt-6">
                  <button
                    onClick={handleAddProduct}
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                  >
                    Add Your First Product
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SKU/Barcode
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProducts.map((product) => {
                      const stockStatus = getStockStatus(product)
                      return (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{product.name}</div>
                              <div className="text-sm text-gray-500">{product.description}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{product.sku}</div>
                            <div className="text-sm text-gray-500">{product.barcode}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                              {product.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}>
                                {product.current_stock} {product.unit}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Min: {product.minimum_stock} | Max: {product.maximum_stock}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{formatCurrency(product.selling_price)}</div>
                            <div className="text-sm text-gray-500">Cost: {formatCurrency(product.cost_price)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {product.location}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleStockUpdate(product)}
                                className="text-blue-600 hover:text-blue-900 p-1"
                                title="Update Stock"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleEditProduct(product)}
                                className="text-primary-600 hover:text-primary-900 p-1"
                                title="Edit Product"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product)}
                                className="text-red-600 hover:text-red-900 p-1"
                                title="Delete Product"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-xl bg-white">
            <form onSubmit={handleFormSubmit}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Product Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter product name"
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    id="category_id"
                    value={formData.category_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>

                {/* Supplier */}
                <div>
                  <label htmlFor="supplier_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Supplier
                  </label>
                  <select
                    id="supplier_id"
                    value={formData.supplier_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Select supplier</option>
                    {suppliers.map(supplier => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </div>

                {/* SKU */}
                <div>
                  <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-2">
                    SKU *
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Enter SKU"
                      required
                    />
                    <button
                      type="button"
                      onClick={generateSKU}
                      className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      title="Generate SKU"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Barcode */}
                <div>
                  <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 mb-2">
                    Barcode
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Enter barcode"
                    />
                    <button
                      type="button"
                      onClick={generateBarcodeNumber}
                      className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      title="Generate Barcode"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Unit */}
                <div>
                  <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-2">
                    Unit
                  </label>
                  <input
                    type="text"
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g., piece, bottle, jar"
                  />
                </div>

                {/* Cost Price */}
                <div>
                  <label htmlFor="cost_price" className="block text-sm font-medium text-gray-700 mb-2">
                    Cost Price (₦) *
                  </label>
                  <input
                    type="number"
                    id="cost_price"
                    value={formData.cost_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost_price: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter cost price"
                    min="0"
                    required
                  />
                </div>

                {/* Selling Price */}
                <div>
                  <label htmlFor="selling_price" className="block text-sm font-medium text-gray-700 mb-2">
                    Selling Price (₦) *
                  </label>
                  <input
                    type="number"
                    id="selling_price"
                    value={formData.selling_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, selling_price: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter selling price"
                    min="0"
                    required
                  />
                </div>

                {/* Current Stock */}
                <div>
                  <label htmlFor="current_stock" className="block text-sm font-medium text-gray-700 mb-2">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    id="current_stock"
                    value={formData.current_stock}
                    onChange={(e) => setFormData(prev => ({ ...prev, current_stock: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter current stock"
                    min="0"
                  />
                </div>

                {/* Minimum Stock */}
                <div>
                  <label htmlFor="minimum_stock" className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Stock
                  </label>
                  <input
                    type="number"
                    id="minimum_stock"
                    value={formData.minimum_stock}
                    onChange={(e) => setFormData(prev => ({ ...prev, minimum_stock: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter minimum stock"
                    min="0"
                  />
                </div>

                {/* Maximum Stock */}
                <div>
                  <label htmlFor="maximum_stock" className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Stock
                  </label>
                  <input
                    type="number"
                    id="maximum_stock"
                    value={formData.maximum_stock}
                    onChange={(e) => setFormData(prev => ({ ...prev, maximum_stock: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter maximum stock"
                    min="0"
                  />
                </div>

                {/* Location */}
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                    Storage Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="e.g., Shelf A1, Storage Room"
                  />
                </div>

                {/* Expiry Date */}
                <div>
                  <label htmlFor="expiry_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    id="expiry_date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="mt-6">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Describe the product..."
                />
              </div>

              {/* Active Status */}
              <div className="mt-6">
                <div className="flex items-center">
                  <input
                    id="is_active"
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                    Product is active and available
                  </label>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-4 mt-8">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <ButtonSpinner className="mr-2" />
                      {editingProduct ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    editingProduct ? 'Update Product' : 'Add Product'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Update Modal */}
      {showStockModal && stockProduct && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-xl bg-white">
            <form onSubmit={handleStockSubmit}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  Update Stock
                </h3>
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  <strong>{stockProduct.name}</strong>
                </p>
                <p className="text-sm text-gray-500">
                  Current Stock: {stockProduct.current_stock} {stockProduct.unit}
                </p>
              </div>

              {/* Stock Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Operation *
                </label>
                <select
                  value={stockData.type}
                  onChange={(e) => setStockData(prev => ({ ...prev, type: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="in">Stock In (Add)</option>
                  <option value="out">Stock Out (Remove)</option>
                  <option value="adjustment">Stock Adjustment (Set)</option>
                </select>
              </div>

              {/* Quantity */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity *
                </label>
                <input
                  type="number"
                  value={stockData.quantity}
                  onChange={(e) => setStockData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter quantity"
                  min="0"
                  required
                />
              </div>

              {/* Reason */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason *
                </label>
                <select
                  value={stockData.reason}
                  onChange={(e) => setStockData(prev => ({ ...prev, reason: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Select reason</option>
                  <option value="purchase">New Purchase</option>
                  <option value="return">Customer Return</option>
                  <option value="sale">Sale</option>
                  <option value="damage">Damaged/Expired</option>
                  <option value="theft">Theft/Loss</option>
                  <option value="adjustment">Stock Count Adjustment</option>
                  <option value="transfer">Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={stockData.notes}
                  onChange={(e) => setStockData(prev => ({ ...prev, notes: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Additional notes (optional)..."
                />
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Cancel
                </button>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <ButtonSpinner className="mr-2" />
                      Updating...
                    </>
                  ) : (
                    'Update Stock'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

export default Inventory