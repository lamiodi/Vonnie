import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { LoadingSpinner, ButtonSpinner } from '../../components/ui/LoadingSpinner'
import PaystackPayment, { PaymentSummary } from '../../components/payment/PaystackPayment'
import { usePayment } from '../../hooks/usePayment'
import { toast } from 'react-hot-toast'
import { formatCurrency, formatDate, formatTime } from '../../lib/utils'

const BookService = () => {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [services, setServices] = useState([])
  const [staff, setStaff] = useState([])
  const [availableSlots, setAvailableSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [bookingData, setBookingData] = useState({
    service_id: '',
    staff_id: '',
    appointment_date: '',
    appointment_time: '',
    notes: '',
    total_amount: 0
  })

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchServices = async () => {
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        
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
          },
          {
            id: 6,
            name: 'Hair Treatment',
            description: 'Deep conditioning and repair treatment',
            duration: 120,
            price: 120000,
            category: 'Hair Care',
            image: '/api/placeholder/300/200'
          }
        ]
        
        setServices(mockServices)
      } catch (error) {
        console.error('Error fetching services:', error)
        toast.error('Failed to load services')
      }
    }

    fetchServices()
  }, [])

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const mockStaff = [
          {
            id: 1,
            name: 'Alice Brown',
            specialties: ['Hair Styling', 'Hair Treatment'],
            rating: 4.9,
            experience: '5+ years',
            image: '/api/placeholder/100/100'
          },
          {
            id: 2,
            name: 'Emma Davis',
            specialties: ['Manicure & Pedicure', 'Nail Art'],
            rating: 4.8,
            experience: '3+ years',
            image: '/api/placeholder/100/100'
          },
          {
            id: 3,
            name: 'Sarah Wilson',
            specialties: ['Facial Treatment', 'Skin Care'],
            rating: 4.9,
            experience: '4+ years',
            image: '/api/placeholder/100/100'
          },
          {
            id: 4,
            name: 'Lisa Johnson',
            specialties: ['Makeup Application', 'Eyebrow Shaping'],
            rating: 4.7,
            experience: '2+ years',
            image: '/api/placeholder/100/100'
          }
        ]
        
        setStaff(mockStaff)
      } catch (error) {
        console.error('Error fetching staff:', error)
        toast.error('Failed to load staff')
      }
    }

    fetchStaff()
  }, [])

  // Fetch available time slots when date and staff are selected
  useEffect(() => {
    if (bookingData.appointment_date && bookingData.staff_id) {
      fetchAvailableSlots()
    }
  }, [bookingData.appointment_date, bookingData.staff_id])

  const fetchAvailableSlots = async () => {
    setLoadingSlots(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock available slots
      const mockSlots = [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
      ]
      
      // Randomly make some slots unavailable
      const availableSlots = mockSlots.filter(() => Math.random() > 0.3)
      
      setAvailableSlots(availableSlots)
    } catch (error) {
      console.error('Error fetching available slots:', error)
      toast.error('Failed to load available time slots')
    } finally {
      setLoadingSlots(false)
    }
  }

  const handleServiceSelect = (service) => {
    setBookingData(prev => ({
      ...prev,
      service_id: service.id,
      total_amount: service.price
    }))
    setCurrentStep(2)
  }

  const handleStaffSelect = (staffMember) => {
    setBookingData(prev => ({
      ...prev,
      staff_id: staffMember.id
    }))
    setCurrentStep(3)
  }

  const handleDateSelect = (date) => {
    setBookingData(prev => ({
      ...prev,
      appointment_date: date,
      appointment_time: '' // Reset time when date changes
    }))
  }

  const handleTimeSelect = (time) => {
    setBookingData(prev => ({
      ...prev,
      appointment_time: time
    }))
    setCurrentStep(4)
  }

  const handleNotesChange = (e) => {
    setBookingData(prev => ({
      ...prev,
      notes: e.target.value
    }))
  }

  const handleBookingSubmit = async () => {
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock successful booking
      toast.success('Appointment booked successfully!')
      navigate('/dashboard/appointments')
    } catch (error) {
      console.error('Error booking appointment:', error)
      toast.error('Failed to book appointment. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const getSelectedService = () => services.find(s => s.id === bookingData.service_id)
  const getSelectedStaff = () => staff.find(s => s.id === bookingData.staff_id)

  const getMinDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  const getMaxDate = () => {
    const maxDate = new Date()
    maxDate.setDate(maxDate.getDate() + 30) // 30 days from now
    return maxDate.toISOString().split('T')[0]
  }

  const steps = [
    { number: 1, name: 'Select Service', completed: currentStep > 1 },
    { number: 2, name: 'Choose Staff', completed: currentStep > 2 },
    { number: 3, name: 'Pick Date & Time', completed: currentStep > 3 },
    { number: 4, name: 'Confirm Booking', completed: false }
  ]

  return (
    <DashboardLayout title="Book Service">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    step.completed || currentStep === step.number
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-gray-300 text-gray-500'
                  }`}>
                    {step.completed ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-sm font-medium">{step.number}</span>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${
                      step.completed || currentStep === step.number
                        ? 'text-primary-600'
                        : 'text-gray-500'
                    }`}>
                      {step.name}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-4 ${
                      step.completed ? 'bg-primary-600' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step 1: Select Service */}
          {currentStep === 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Select a Service</h2>
              
              {services.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <LoadingSpinner size="lg" text="Loading services..." />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {services.map((service) => (
                    <div
                      key={service.id}
                      onClick={() => handleServiceSelect(service)}
                      className="border border-gray-200 rounded-xl p-6 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="aspect-w-16 aspect-h-9 mb-4">
                        <div className="w-full h-32 bg-gradient-to-br from-primary-100 to-secondary-100 rounded-lg flex items-center justify-center">
                          <svg className="w-12 h-12 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h6m-6 0l-1 12a2 2 0 002 2h6a2 2 0 002-2L16 7" />
                          </svg>
                        </div>
                      </div>
                      
                      <div className="mb-2">
                        <span className="inline-block px-2 py-1 text-xs font-medium text-primary-600 bg-primary-100 rounded-full">
                          {service.category}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {service.name}
                      </h3>
                      
                      <p className="text-gray-600 text-sm mb-4">{service.description}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {service.duration} mins
                          </span>
                        </div>
                        <div className="text-lg font-bold text-primary-600">
                          {formatCurrency(service.price)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Choose Staff */}
          {currentStep === 2 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Choose Your Specialist</h2>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  ← Back to Services
                </button>
              </div>
              
              {/* Selected Service Summary */}
              {getSelectedService() && (
                <div className="bg-primary-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-primary-900">{getSelectedService().name}</h3>
                      <p className="text-primary-700 text-sm">{getSelectedService().duration} minutes</p>
                    </div>
                    <div className="text-primary-900 font-bold">
                      {formatCurrency(getSelectedService().price)}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {staff.map((staffMember) => (
                  <div
                    key={staffMember.id}
                    onClick={() => handleStaffSelect(staffMember)}
                    className="border border-gray-200 rounded-xl p-6 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-center mb-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-secondary-400 to-secondary-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xl font-bold">
                          {staffMember.name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                          {staffMember.name}
                        </h3>
                        <div className="flex items-center">
                          <div className="flex items-center">
                            {[...Array(5)].map((_, i) => (
                              <svg
                                key={i}
                                className={`w-4 h-4 ${
                                  i < Math.floor(staffMember.rating) ? 'text-yellow-400' : 'text-gray-300'
                                }`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                          <span className="ml-2 text-sm text-gray-600">{staffMember.rating}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Experience: {staffMember.experience}</p>
                      <div className="flex flex-wrap gap-2">
                        {staffMember.specialties.map((specialty, index) => (
                          <span
                            key={index}
                            className="inline-block px-2 py-1 text-xs font-medium text-secondary-600 bg-secondary-100 rounded-full"
                          >
                            {specialty}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Pick Date & Time */}
          {currentStep === 3 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Pick Date & Time</h2>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  ← Back to Staff
                </button>
              </div>
              
              {/* Booking Summary */}
              <div className="bg-primary-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold text-primary-900">Service</h3>
                    <p className="text-primary-700">{getSelectedService()?.name}</p>
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary-900">Specialist</h3>
                    <p className="text-primary-700">{getSelectedStaff()?.name}</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Date Selection */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Date</h3>
                  <input
                    type="date"
                    value={bookingData.appointment_date}
                    onChange={(e) => handleDateSelect(e.target.value)}
                    min={getMinDate()}
                    max={getMaxDate()}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                
                {/* Time Selection */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Time</h3>
                  {!bookingData.appointment_date ? (
                    <p className="text-gray-500 text-center py-8">Please select a date first</p>
                  ) : loadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <LoadingSpinner text="Loading available times..." />
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No available time slots for this date</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => handleTimeSelect(slot)}
                          className={`p-3 text-sm font-medium rounded-lg border transition-colors ${
                            bookingData.appointment_time === slot
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-primary-300 hover:bg-primary-50'
                          }`}
                        >
                          {formatTime(slot)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {bookingData.appointment_time && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setCurrentStep(4)}
                    className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                  >
                    Continue to Confirmation
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Confirm Booking */}
          {currentStep === 4 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Confirm Your Booking</h2>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  ← Back to Date & Time
                </button>
              </div>
              
              {/* Booking Summary */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service:</span>
                    <span className="font-medium">{getSelectedService()?.name}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Specialist:</span>
                    <span className="font-medium">{getSelectedStaff()?.name}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Date:</span>
                    <span className="font-medium">{formatDate(new Date(bookingData.appointment_date))}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Time:</span>
                    <span className="font-medium">{formatTime(bookingData.appointment_time)}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">{getSelectedService()?.duration} minutes</span>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Amount:</span>
                      <span className="text-primary-600">{formatCurrency(bookingData.total_amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Additional Notes */}
              <div className="mb-6">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={bookingData.notes}
                  onChange={handleNotesChange}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Any special requests or notes for your appointment..."
                />
              </div>
              
              {/* Terms and Conditions */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h4 className="font-medium text-yellow-800 mb-2">Booking Terms & Conditions</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Appointments can be cancelled up to 24 hours in advance</li>
                  <li>• Late cancellations may incur a 50% charge</li>
                  <li>• Please arrive 10 minutes before your appointment time</li>
                  <li>• Payment is due at the time of service</li>
                </ul>
              </div>
              
              {/* Confirm Button */}
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Start Over
                </button>
                
                <button
                  onClick={handleBookingSubmit}
                  disabled={isLoading}
                  className="flex items-center px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? (
                    <>
                      <ButtonSpinner className="mr-2" />
                      Booking...
                    </>
                  ) : (
                    'Confirm Booking'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

export default BookService