import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { LoadingSpinner, ButtonSpinner } from '../../components/ui/LoadingSpinner'
import { toast } from 'react-hot-toast'
import { formatCurrency } from '../../lib/utils'

const Services = () => {
  const { user, profile } = useAuth()
  const [services, setServices] = useState([])
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('name')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    duration: '',
    is_active: true,
    requirements: '',
    benefits: ''
  })

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        const mockCategories = [
          { id: 1, name: 'Hair Care', description: 'Hair styling and treatment services' },
          { id: 2, name: 'Nail Care', description: 'Manicure and pedicure services' },
          { id: 3, name: 'Skin Care', description: 'Facial and skin treatment services' },
          { id: 4, name: 'Beauty', description: 'Makeup and beauty enhancement services' },
          { id: 5, name: 'Wellness', description: 'Relaxation and wellness services' }
        ]
        
        const mockServices = [
          {
            id: 1,
            name: 'Hair Styling',
            description: 'Professional hair styling and treatment for all hair types',
            category: 'Hair Care',
            price: 85000,
            duration: 90,
            is_active: true,
            requirements: 'Clean hair preferred',
            benefits: 'Professional styling, hair health improvement',
            bookings_count: 45,
            rating: 4.8,
            created_at: '2024-01-01T00:00:00Z'
          },
          {
            id: 2,
            name: 'Manicure & Pedicure',
            description: 'Complete nail care and beautification service',
            category: 'Nail Care',
            price: 45000,
            duration: 60,
            is_active: true,
            requirements: 'No nail polish 24 hours before',
            benefits: 'Healthy nails, beautiful appearance',
            bookings_count: 67,
            rating: 4.9,
            created_at: '2024-01-01T00:00:00Z'
          },
          {
            id: 3,
            name: 'Facial Treatment',
            description: 'Deep cleansing and rejuvenating facial treatment',
            category: 'Skin Care',
            price: 65000,
            duration: 75,
            is_active: true,
            requirements: 'No makeup on treatment day',
            benefits: 'Cleaner skin, reduced acne, anti-aging',
            bookings_count: 32,
            rating: 4.7,
            created_at: '2024-01-01T00:00:00Z'
          },
          {
            id: 4,
            name: 'Eyebrow Shaping',
            description: 'Professional eyebrow threading and shaping',
            category: 'Beauty',
            price: 25000,
            duration: 30,
            is_active: true,
            requirements: 'Let eyebrows grow for 2 weeks',
            benefits: 'Perfect eyebrow shape, enhanced facial features',
            bookings_count: 89,
            rating: 4.6,
            created_at: '2024-01-01T00:00:00Z'
          },
          {
            id: 5,
            name: 'Makeup Application',
            description: 'Professional makeup for special occasions',
            category: 'Beauty',
            price: 55000,
            duration: 45,
            is_active: true,
            requirements: 'Clean face, bring reference photos',
            benefits: 'Professional look, long-lasting makeup',
            bookings_count: 23,
            rating: 4.8,
            created_at: '2024-01-01T00:00:00Z'
          },
          {
            id: 6,
            name: 'Hair Treatment',
            description: 'Deep conditioning and repair treatment',
            category: 'Hair Care',
            price: 120000,
            duration: 120,
            is_active: false,
            requirements: 'Consultation required',
            benefits: 'Hair repair, moisture restoration, shine',
            bookings_count: 15,
            rating: 4.9,
            created_at: '2024-01-01T00:00:00Z'
          },
          {
            id: 7,
            name: 'Relaxation Massage',
            description: 'Full body relaxation and stress relief massage',
            category: 'Wellness',
            price: 95000,
            duration: 60,
            is_active: true,
            requirements: 'Comfortable clothing',
            benefits: 'Stress relief, muscle relaxation, improved circulation',
            bookings_count: 28,
            rating: 4.7,
            created_at: '2024-01-01T00:00:00Z'
          }
        ]
        
        setCategories(mockCategories)
        setServices(mockServices)
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load services')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const getFilteredServices = () => {
    let filtered = services

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(service => service.category === selectedCategory)
    }

    // Sort services
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'price':
          return a.price - b.price
        case 'duration':
          return a.duration - b.duration
        case 'bookings':
          return b.bookings_count - a.bookings_count
        case 'rating':
          return b.rating - a.rating
        default:
          return 0
      }
    })

    return filtered
  }

  const handleAddService = () => {
    setEditingService(null)
    setFormData({
      name: '',
      description: '',
      category: '',
      price: '',
      duration: '',
      is_active: true,
      requirements: '',
      benefits: ''
    })
    setShowModal(true)
  }

  const handleEditService = (service) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      description: service.description,
      category: service.category,
      price: service.price.toString(),
      duration: service.duration.toString(),
      is_active: service.is_active,
      requirements: service.requirements || '',
      benefits: service.benefits || ''
    })
    setShowModal(true)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validate form
      if (!formData.name || !formData.description || !formData.category || !formData.price || !formData.duration) {
        toast.error('Please fill in all required fields')
        return
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      const serviceData = {
        ...formData,
        price: parseInt(formData.price),
        duration: parseInt(formData.duration),
        id: editingService ? editingService.id : Date.now(),
        bookings_count: editingService ? editingService.bookings_count : 0,
        rating: editingService ? editingService.rating : 0,
        created_at: editingService ? editingService.created_at : new Date().toISOString()
      }

      if (editingService) {
        // Update existing service
        setServices(prev => prev.map(service => 
          service.id === editingService.id ? serviceData : service
        ))
        toast.success('Service updated successfully')
      } else {
        // Add new service
        setServices(prev => [...prev, serviceData])
        toast.success('Service added successfully')
      }

      setShowModal(false)
    } catch (error) {
      console.error('Error saving service:', error)
      toast.error('Failed to save service. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleStatus = async (service) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setServices(prev => prev.map(s => 
        s.id === service.id ? { ...s, is_active: !s.is_active } : s
      ))
      
      toast.success(`Service ${service.is_active ? 'deactivated' : 'activated'} successfully`)
    } catch (error) {
      console.error('Error toggling service status:', error)
      toast.error('Failed to update service status')
    }
  }

  const handleDeleteService = async (service) => {
    if (!window.confirm(`Are you sure you want to delete "${service.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setServices(prev => prev.filter(s => s.id !== service.id))
      toast.success('Service deleted successfully')
    } catch (error) {
      console.error('Error deleting service:', error)
      toast.error('Failed to delete service')
    }
  }

  const filteredServices = getFilteredServices()

  return (
    <DashboardLayout title="Services Management">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Services Management</h1>
              <p className="mt-2 text-gray-600">Manage your beauty services and pricing</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <button
                onClick={handleAddService}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add New Service
              </button>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                  Search Services
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Search by name or description..."
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
                    <option key={category.id} value={category.name}>{category.name}</option>
                  ))}
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
                  <option value="price">Price</option>
                  <option value="duration">Duration</option>
                  <option value="bookings">Bookings</option>
                  <option value="rating">Rating</option>
                </select>
              </div>

              {/* Stats */}
              <div className="flex items-end">
                <div className="text-sm text-gray-600">
                  <p>Total: {services.length} services</p>
                  <p>Active: {services.filter(s => s.is_active).length}</p>
                  <p>Showing: {filteredServices.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Services List */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner size="lg" text="Loading services..." />
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h6m-6 0l-1 12a2 2 0 002 2h6a2 2 0 002-2L16 7" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No services found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || selectedCategory !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by adding your first service.'
                }
              </p>
              {!searchTerm && selectedCategory === 'all' && (
                <div className="mt-6">
                  <button
                    onClick={handleAddService}
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                  >
                    Add Your First Service
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className={`bg-white rounded-xl shadow-sm border-2 p-6 transition-all hover:shadow-md ${
                    service.is_active ? 'border-gray-200' : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className={`text-lg font-semibold ${
                          service.is_active ? 'text-gray-900' : 'text-gray-500'
                        }`}>
                          {service.name}
                        </h3>
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          service.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {service.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <span className="inline-block px-2 py-1 text-xs font-medium text-primary-600 bg-primary-100 rounded-full">
                        {service.category}
                      </span>
                    </div>
                  </div>

                  <p className={`text-sm mb-4 ${
                    service.is_active ? 'text-gray-600' : 'text-gray-500'
                  }`}>
                    {service.description}
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Price</p>
                      <p className="text-lg font-bold text-primary-600">
                        {formatCurrency(service.price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Duration</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {service.duration} mins
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(service.rating) ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="ml-2 text-sm text-gray-600">{service.rating}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {service.bookings_count} bookings
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between space-x-2">
                    <button
                      onClick={() => handleEditService(service)}
                      className="flex items-center px-3 py-2 text-sm font-medium text-primary-600 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>

                    <button
                      onClick={() => handleToggleStatus(service)}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                        service.is_active
                          ? 'text-yellow-600 bg-yellow-50 border-yellow-200 hover:bg-yellow-100 focus:ring-yellow-500'
                          : 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100 focus:ring-green-500'
                      }`}
                    >
                      {service.is_active ? (
                        <>
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          Deactivate
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Activate
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteService(service)}
                      className="flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Service Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-xl bg-white">
            <form onSubmit={handleFormSubmit}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingService ? 'Edit Service' : 'Add New Service'}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Service Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Service Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter service name"
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.name}>{category.name}</option>
                    ))}
                  </select>
                </div>

                {/* Price */}
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                    Price (₦) *
                  </label>
                  <input
                    type="number"
                    id="price"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter price"
                    min="0"
                    required
                  />
                </div>

                {/* Duration */}
                <div>
                  <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes) *
                  </label>
                  <input
                    type="number"
                    id="duration"
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter duration in minutes"
                    min="15"
                    step="15"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div className="mt-6">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Describe the service..."
                  required
                />
              </div>

              {/* Requirements */}
              <div className="mt-6">
                <label htmlFor="requirements" className="block text-sm font-medium text-gray-700 mb-2">
                  Requirements
                </label>
                <textarea
                  id="requirements"
                  rows={2}
                  value={formData.requirements}
                  onChange={(e) => setFormData(prev => ({ ...prev, requirements: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Any special requirements or preparations..."
                />
              </div>

              {/* Benefits */}
              <div className="mt-6">
                <label htmlFor="benefits" className="block text-sm font-medium text-gray-700 mb-2">
                  Benefits
                </label>
                <textarea
                  id="benefits"
                  rows={2}
                  value={formData.benefits}
                  onChange={(e) => setFormData(prev => ({ ...prev, benefits: e.target.value }))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Benefits of this service..."
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
                    Service is active and available for booking
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
                      {editingService ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    editingService ? 'Update Service' : 'Add Service'
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

export default Services