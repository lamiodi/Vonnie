import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingSpinner, ButtonSpinner } from '../../components/ui/LoadingSpinner'
import PublicHeader from '../../components/layout/PublicHeader'
import { toast } from 'react-hot-toast'
import { formatCurrency, formatDate, formatTime, isValidEmail, isValidPhone } from '../../lib/utils'
import { Helmet } from 'react-helmet-async'

const GuestBooking = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [services, setServices] = useState([])
  const [staff, setStaff] = useState([])
  const [availableSlots, setAvailableSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [bookingData, setBookingData] = useState({
    // Guest information
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    
    // Booking details
    service_id: '',
    staff_id: '',
    appointment_date: '',
    appointment_time: '',
    notes: '',
    total_amount: 0
  })

  const [errors, setErrors] = useState({})

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setIsLoading(true)
        
        const mockServices = [
          {
            id: 1,
            name: 'Hair Styling',
            description: 'Professional hair styling and treatment',
            duration: 90,
            price: 85000,
            category: 'Hair Care',
            image: '/api/placeholder/300/200'
          },
          {
            id: 2,
            name: 'Manicure & Pedicure',
            description: 'Complete nail care and beautification',
            duration: 60,
            price: 45000,
            category: 'Nail Care',
            image: '/api/placeholder/300/200'
          },
          {
            id: 3,
            name: 'Facial Treatment',
            description: 'Deep cleansing and rejuvenating facial',
            duration: 75,
            price: 65000,
            category: 'Skin Care',
            image: '/api/placeholder/300/200'
          },
          {
            id: 4,
            name: 'Eyebrow Shaping',
            description: 'Professional eyebrow threading and shaping',
            duration: 30,
            price: 25000,
            category: 'Beauty',
            image: '/api/placeholder/300/200'
          },
          {
            id: 5,
            name: 'Makeup Application',
            description: 'Professional makeup for special occasions',
            duration: 45,
            price: 55000,
            category: 'Beauty',
            image: '/api/placeholder/300/200'
          }
        ]
        
        setServices(mockServices)
      } catch (error) {
        console.error('Error fetching services:', error)
        toast.error('Failed to load services')
      } finally {
        setIsLoading(false)
      }
    }

    fetchServices()
  }, [])

  useEffect(() => {
    if (bookingData.service_id) {
      const fetchStaff = async () => {
        try {
          const mockStaff = [
            {
              id: 1,
              name: 'Sarah Johnson',
              specialization: 'Hair Styling & Treatment',
              experience: '5+ years',
              rating: 4.9,
              image: '/api/placeholder/150/150'
            },
            {
              id: 2,
              name: 'Maria Santos',
              specialization: 'Nail Care & Beauty',
              experience: '3+ years',
              rating: 4.8,
              image: '/api/placeholder/150/150'
            },
            {
              id: 3,
              name: 'Jennifer Lee',
              specialization: 'Skin Care & Facial',
              experience: '4+ years',
              rating: 4.9,
              image: '/api/placeholder/150/150'
            }
          ]
          
          setStaff(mockStaff)
        } catch (error) {
          console.error('Error fetching staff:', error)
          toast.error('Failed to load staff')
        }
      }

      fetchStaff()
    }
  }, [bookingData.service_id])

  const validateGuestInfo = () => {
    const newErrors = {}

    if (!bookingData.guest_name.trim()) {
      newErrors.guest_name = 'Name is required'
    }

    if (!bookingData.guest_email.trim()) {
      newErrors.guest_email = 'Email is required'
    } else if (!isValidEmail(bookingData.guest_email)) {
      newErrors.guest_email = 'Please enter a valid email address'
    }

    if (!bookingData.guest_phone.trim()) {
      newErrors.guest_phone = 'Phone number is required'
    } else if (!isValidPhone(bookingData.guest_phone)) {
      newErrors.guest_phone = 'Please enter a valid phone number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleServiceSelect = (service) => {
    setBookingData(prev => ({
      ...prev,
      service_id: service.id,
      total_amount: service.price
    }))
    setCurrentStep(2)
  }

  const handleStaffSelect = (selectedStaff) => {
    setBookingData(prev => ({
      ...prev,
      staff_id: selectedStaff.id
    }))
    setCurrentStep(3)
  }

  const handleDateTimeSelect = (date, time) => {
    setBookingData(prev => ({
      ...prev,
      appointment_date: date,
      appointment_time: time
    }))
    setCurrentStep(4)
  }

  const handleGuestInfoSubmit = (e) => {
    e.preventDefault()
    if (validateGuestInfo()) {
      setCurrentStep(5)
    }
  }

  const handleBookingSubmit = async () => {
    try {
      setIsLoading(true)
      
      // Simulate API call to create guest booking
      const guestBooking = {
        guest_name: bookingData.guest_name,
        guest_email: bookingData.guest_email,
        guest_phone: bookingData.guest_phone,
        service_id: bookingData.service_id,
        staff_id: bookingData.staff_id,
        appointment_date: bookingData.appointment_date,
        appointment_time: bookingData.appointment_time,
        notes: bookingData.notes,
        total_amount: bookingData.total_amount,
        booking_type: 'guest',
        status: 'pending'
      }

      console.log('Creating guest booking:', guestBooking)
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast.success('Booking request submitted successfully! We will contact you to confirm your appointment.')
      
      // Reset form
      setBookingData({
        guest_name: '',
        guest_email: '',
        guest_phone: '',
        service_id: '',
        staff_id: '',
        appointment_date: '',
        appointment_time: '',
        notes: '',
        total_amount: 0
      })
      setCurrentStep(1)
      
    } catch (error) {
      console.error('Booking error:', error)
      toast.error('Failed to submit booking. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const selectedService = services.find(s => s.id === bookingData.service_id)
  const selectedStaff = staff.find(s => s.id === bookingData.staff_id)

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4, 5].map((step) => (
        <React.Fragment key={step}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
            step <= currentStep 
              ? 'bg-primary-600 text-white' 
              : 'bg-gray-200 text-gray-600'
          }`}>
            {step}
          </div>
          {step < 5 && (
            <div className={`w-12 h-1 mx-2 ${
              step < currentStep ? 'bg-primary-600' : 'bg-gray-200'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  )

  const renderServiceSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Service</h2>
        <p className="text-gray-600">Select the service you'd like to book</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
              onClick={() => handleServiceSelect(service)}
            >
              <div className="h-48 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                <div className="text-primary-600 text-4xl">💅</div>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {service.duration}min
                  </span>
                </div>
                <p className="text-gray-600 text-sm mb-4">{service.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-primary-600">
                    {formatCurrency(service.price)}
                  </span>
                  <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                    Select
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderStaffSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Stylist</h2>
        <p className="text-gray-600">Select your preferred professional</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.map((member) => (
          <div
            key={member.id}
            className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
            onClick={() => handleStaffSelect(member)}
          >
            <div className="h-48 bg-gradient-to-br from-secondary-100 to-secondary-200 flex items-center justify-center">
              <div className="text-secondary-600 text-4xl">👩‍💼</div>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{member.name}</h3>
              <p className="text-gray-600 text-sm mb-2">{member.specialization}</p>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-gray-500">{member.experience}</span>
                <div className="flex items-center">
                  <span className="text-yellow-400">⭐</span>
                  <span className="text-sm text-gray-600 ml-1">{member.rating}</span>
                </div>
              </div>
              <button className="w-full px-4 py-2 bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 transition-colors">
                Select Stylist
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderDateTimeSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Date & Time</h2>
        <p className="text-gray-600">Select your preferred appointment slot</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Date
            </label>
            <input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={bookingData.appointment_date}
              onChange={(e) => setBookingData(prev => ({ ...prev, appointment_date: e.target.value }))}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Time
            </label>
            <select
              value={bookingData.appointment_time}
              onChange={(e) => setBookingData(prev => ({ ...prev, appointment_time: e.target.value }))}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select time</option>
              <option value="09:00">9:00 AM</option>
              <option value="10:00">10:00 AM</option>
              <option value="11:00">11:00 AM</option>
              <option value="12:00">12:00 PM</option>
              <option value="13:00">1:00 PM</option>
              <option value="14:00">2:00 PM</option>
              <option value="15:00">3:00 PM</option>
              <option value="16:00">4:00 PM</option>
              <option value="17:00">5:00 PM</option>
            </select>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Special Notes (Optional)
          </label>
          <textarea
            value={bookingData.notes}
            onChange={(e) => setBookingData(prev => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Any special requests or notes..."
          />
        </div>

        <div className="mt-6 flex justify-between">
          <button
            onClick={() => setCurrentStep(2)}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={() => bookingData.appointment_date && bookingData.appointment_time && setCurrentStep(4)}
            disabled={!bookingData.appointment_date || !bookingData.appointment_time}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )

  const renderGuestInfo = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Information</h2>
        <p className="text-gray-600">Please provide your contact details</p>
      </div>

      <form onSubmit={handleGuestInfoSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name *
          </label>
          <input
            type="text"
            value={bookingData.guest_name}
            onChange={(e) => setBookingData(prev => ({ ...prev, guest_name: e.target.value }))}
            className={`w-full px-3 py-3 border ${errors.guest_name ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500`}
            placeholder="Enter your full name"
          />
          {errors.guest_name && (
            <p className="mt-1 text-sm text-red-600">{errors.guest_name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address *
          </label>
          <input
            type="email"
            value={bookingData.guest_email}
            onChange={(e) => setBookingData(prev => ({ ...prev, guest_email: e.target.value }))}
            className={`w-full px-3 py-3 border ${errors.guest_email ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500`}
            placeholder="Enter your email address"
          />
          {errors.guest_email && (
            <p className="mt-1 text-sm text-red-600">{errors.guest_email}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number *
          </label>
          <input
            type="tel"
            value={bookingData.guest_phone}
            onChange={(e) => setBookingData(prev => ({ ...prev, guest_phone: e.target.value }))}
            className={`w-full px-3 py-3 border ${errors.guest_phone ? 'border-red-300' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500`}
            placeholder="08012345678"
          />
          {errors.guest_phone && (
            <p className="mt-1 text-sm text-red-600">{errors.guest_phone}</p>
          )}
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setCurrentStep(3)}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Back
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Continue
          </button>
        </div>
      </form>
    </div>
  )

  const renderConfirmation = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Confirm Your Booking</h2>
        <p className="text-gray-600">Please review your appointment details</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Guest Information</h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Name:</span> {bookingData.guest_name}</p>
            <p><span className="font-medium">Email:</span> {bookingData.guest_email}</p>
            <p><span className="font-medium">Phone:</span> {bookingData.guest_phone}</p>
          </div>
        </div>

        <div className="border-b pb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Appointment Details</h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Service:</span> {selectedService?.name}</p>
            <p><span className="font-medium">Stylist:</span> {selectedStaff?.name}</p>
            <p><span className="font-medium">Date:</span> {formatDate(bookingData.appointment_date)}</p>
            <p><span className="font-medium">Time:</span> {formatTime(bookingData.appointment_time)}</p>
            <p><span className="font-medium">Duration:</span> {selectedService?.duration} minutes</p>
            {bookingData.notes && (
              <p><span className="font-medium">Notes:</span> {bookingData.notes}</p>
            )}
          </div>
        </div>

        <div className="border-b pb-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total Amount:</span>
            <span className="text-2xl font-bold text-primary-600">
              {formatCurrency(bookingData.total_amount)}
            </span>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="text-blue-600 mr-3">ℹ️</div>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Booking Confirmation</p>
              <p>Your booking request will be submitted and we will contact you within 24 hours to confirm your appointment and discuss payment options.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setCurrentStep(4)}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Back
          </button>
          <button
            onClick={handleBookingSubmit}
            disabled={isLoading}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center"
          >
            {isLoading ? (
              <>
                <ButtonSpinner className="mr-2" />
                Submitting...
              </>
            ) : (
              'Confirm Booking'
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Helmet>
        <title>Book Service - Vonne X2x Management System</title>
        <meta name="description" content="Book your beauty service appointment with Vonne X2x" />
      </Helmet>

      <PublicHeader />

      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {renderStepIndicator()}
          
          {currentStep === 1 && renderServiceSelection()}
          {currentStep === 2 && renderStaffSelection()}
          {currentStep === 3 && renderDateTimeSelection()}
          {currentStep === 4 && renderGuestInfo()}
          {currentStep === 5 && renderConfirmation()}
        </div>
      </div>
    </>
  )
}

export default GuestBooking