import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { LoadingSpinner, ButtonSpinner } from '../../components/ui/LoadingSpinner'
import { toast } from 'react-hot-toast'
import { formatCurrency, formatDate, formatTime } from '../../lib/utils'

const Appointments = () => {
  const { user, profile } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, upcoming, past, cancelled
  const [cancellingId, setCancellingId] = useState(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [appointmentToCancel, setAppointmentToCancel] = useState(null)

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setIsLoading(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        const mockAppointments = [
          {
            id: 1,
            service_name: 'Hair Styling',
            staff_name: 'Alice Brown',
            appointment_date: '2024-01-15',
            appointment_time: '10:00',
            duration: 90,
            amount: 85000,
            status: 'confirmed',
            notes: 'Special occasion styling for wedding',
            created_at: '2024-01-10T08:30:00Z',
            can_cancel: true
          },
          {
            id: 2,
            service_name: 'Manicure & Pedicure',
            staff_name: 'Emma Davis',
            appointment_date: '2024-01-20',
            appointment_time: '14:30',
            duration: 60,
            amount: 45000,
            status: 'confirmed',
            notes: '',
            created_at: '2024-01-12T15:20:00Z',
            can_cancel: true
          },
          {
            id: 3,
            service_name: 'Facial Treatment',
            staff_name: 'Sarah Wilson',
            appointment_date: '2024-01-08',
            appointment_time: '11:00',
            duration: 75,
            amount: 65000,
            status: 'completed',
            notes: 'Deep cleansing treatment',
            created_at: '2024-01-05T10:15:00Z',
            can_cancel: false
          },
          {
            id: 4,
            service_name: 'Makeup Application',
            staff_name: 'Lisa Johnson',
            appointment_date: '2024-01-25',
            appointment_time: '16:00',
            duration: 45,
            amount: 55000,
            status: 'pending',
            notes: 'Evening event makeup',
            created_at: '2024-01-13T12:45:00Z',
            can_cancel: true
          },
          {
            id: 5,
            service_name: 'Hair Treatment',
            staff_name: 'Alice Brown',
            appointment_date: '2024-01-05',
            appointment_time: '09:30',
            duration: 120,
            amount: 120000,
            status: 'cancelled',
            notes: 'Deep conditioning treatment',
            created_at: '2024-01-02T14:20:00Z',
            can_cancel: false
          },
          {
            id: 6,
            service_name: 'Eyebrow Shaping',
            staff_name: 'Lisa Johnson',
            appointment_date: '2024-01-30',
            appointment_time: '13:00',
            duration: 30,
            amount: 25000,
            status: 'confirmed',
            notes: '',
            created_at: '2024-01-14T09:10:00Z',
            can_cancel: true
          }
        ]
        
        setAppointments(mockAppointments)
      } catch (error) {
        console.error('Error fetching appointments:', error)
        toast.error('Failed to load appointments')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAppointments()
  }, [])

  const getFilteredAppointments = () => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    return appointments.filter(appointment => {
      switch (filter) {
        case 'upcoming':
          return appointment.appointment_date >= today && 
                 ['confirmed', 'pending'].includes(appointment.status)
        case 'past':
          return appointment.appointment_date < today || 
                 appointment.status === 'completed'
        case 'cancelled':
          return appointment.status === 'cancelled'
        default:
          return true
      }
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'pending':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'completed':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'cancelled':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      default:
        return null
    }
  }

  const handleCancelAppointment = (appointment) => {
    setAppointmentToCancel(appointment)
    setShowCancelModal(true)
  }

  const confirmCancelAppointment = async () => {
    if (!appointmentToCancel) return
    
    setCancellingId(appointmentToCancel.id)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Update appointment status
      setAppointments(prev => 
        prev.map(apt => 
          apt.id === appointmentToCancel.id 
            ? { ...apt, status: 'cancelled', can_cancel: false }
            : apt
        )
      )
      
      toast.success('Appointment cancelled successfully')
      setShowCancelModal(false)
      setAppointmentToCancel(null)
    } catch (error) {
      console.error('Error cancelling appointment:', error)
      toast.error('Failed to cancel appointment. Please try again.')
    } finally {
      setCancellingId(null)
    }
  }

  const canCancelAppointment = (appointment) => {
    if (!appointment.can_cancel) return false
    
    const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.appointment_time}:00`)
    const now = new Date()
    const hoursUntilAppointment = (appointmentDateTime - now) / (1000 * 60 * 60)
    
    return hoursUntilAppointment > 24 && ['confirmed', 'pending'].includes(appointment.status)
  }

  const filteredAppointments = getFilteredAppointments()

  return (
    <DashboardLayout title="My Appointments">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
              <p className="mt-2 text-gray-600">Manage your beauty service appointments</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <Link
                to="/dashboard/book-service"
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Book New Service
              </Link>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {[
                  { key: 'all', label: 'All Appointments', count: appointments.length },
                  { key: 'upcoming', label: 'Upcoming', count: appointments.filter(a => {
                    const today = new Date().toISOString().split('T')[0]
                    return a.appointment_date >= today && ['confirmed', 'pending'].includes(a.status)
                  }).length },
                  { key: 'past', label: 'Past', count: appointments.filter(a => {
                    const today = new Date().toISOString().split('T')[0]
                    return a.appointment_date < today || a.status === 'completed'
                  }).length },
                  { key: 'cancelled', label: 'Cancelled', count: appointments.filter(a => a.status === 'cancelled').length }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                      filter === tab.key
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                        filter === tab.key
                          ? 'bg-primary-100 text-primary-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Appointments List */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <LoadingSpinner size="lg" text="Loading appointments..." />
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h6m-6 0l-1 12a2 2 0 002 2h6a2 2 0 002-2L16 7" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filter === 'all' 
                  ? "You haven't booked any appointments yet."
                  : `No ${filter} appointments found.`
                }
              </p>
              {filter === 'all' && (
                <div className="mt-6">
                  <Link
                    to="/dashboard/book-service"
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                  >
                    Book Your First Service
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {appointment.service_name}
                          </h3>
                          <p className="text-gray-600">with {appointment.staff_name}</p>
                        </div>
                        <div className="flex items-center ml-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                            {getStatusIcon(appointment.status)}
                            <span className="ml-1 capitalize">{appointment.status}</span>
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 0h6m-6 0l-1 12a2 2 0 002 2h6a2 2 0 002-2L16 7" />
                          </svg>
                          {formatDate(new Date(appointment.appointment_date))}
                        </div>
                        
                        <div className="flex items-center text-sm text-gray-600">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTime(appointment.appointment_time)}
                        </div>
                        
                        <div className="flex items-center text-sm text-gray-600">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {appointment.duration} mins
                        </div>
                        
                        <div className="flex items-center text-sm font-medium text-primary-600">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                          </svg>
                          {formatCurrency(appointment.amount)}
                        </div>
                      </div>
                      
                      {appointment.notes && (
                        <div className="mb-4">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Notes:</span> {appointment.notes}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center space-x-3 mt-4 lg:mt-0 lg:ml-6">
                      {canCancelAppointment(appointment) && (
                        <button
                          onClick={() => handleCancelAppointment(appointment)}
                          disabled={cancellingId === appointment.id}
                          className="flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {cancellingId === appointment.id ? (
                            <>
                              <ButtonSpinner size="sm" className="mr-2" />
                              Cancelling...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Cancel
                            </>
                          )}
                        </button>
                      )}
                      
                      {appointment.status === 'completed' && (
                        <button className="flex items-center px-3 py-2 text-sm font-medium text-primary-600 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                          Rate Service
                        </button>
                      )}
                      
                      <button className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Contact
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && appointmentToCancel && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-xl bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-medium text-gray-900 text-center mt-4">
                Cancel Appointment
              </h3>
              
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to cancel your appointment for <strong>{appointmentToCancel.service_name}</strong> on {formatDate(new Date(appointmentToCancel.appointment_date))} at {formatTime(appointmentToCancel.appointment_time)}?
                </p>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Cancellations made less than 24 hours before the appointment may incur charges.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-center space-x-4 mt-6">
                <button
                  onClick={() => {
                    setShowCancelModal(false)
                    setAppointmentToCancel(null)
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  Keep Appointment
                </button>
                
                <button
                  onClick={confirmCancelAppointment}
                  disabled={cancellingId === appointmentToCancel.id}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {cancellingId === appointmentToCancel.id ? (
                    <>
                      <ButtonSpinner size="sm" className="mr-2" />
                      Cancelling...
                    </>
                  ) : (
                    'Yes, Cancel'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

export default Appointments