import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { LoadingSpinner, ButtonSpinner } from '../../components/ui/LoadingSpinner'
import { toast } from 'react-hot-toast'
import { formatCurrency, formatDate, formatTime } from '../../lib/utils'

const Workers = () => {
  const { user, profile } = useAuth()
  const [workers, setWorkers] = useState([])
  const [departments, setDepartments] = useState([])
  const [shifts, setShifts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [editingWorker, setEditingWorker] = useState(null)
  const [schedulingWorker, setSchedulingWorker] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [activeTab, setActiveTab] = useState('workers') // workers, schedule, performance

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department_id: '',
    position: '',
    employee_id: '',
    hire_date: '',
    salary: '',
    commission_rate: '',
    address: '',
    emergency_contact: '',
    emergency_phone: '',
    skills: '',
    notes: '',
    is_active: true
  })

  const [scheduleData, setScheduleData] = useState({
    worker_id: '',
    shift_id: '',
    date: '',
    start_time: '',
    end_time: '',
    break_duration: '30',
    notes: ''
  })

  // Mock data - replace with actual API calls
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        const mockDepartments = [
          { id: 1, name: 'Hair Styling', description: 'Hair cutting, styling, and treatments' },
          { id: 2, name: 'Nail Care', description: 'Manicure, pedicure, and nail art' },
          { id: 3, name: 'Skin Care', description: 'Facial treatments and skin care' },
          { id: 4, name: 'Makeup', description: 'Makeup application and consultation' },
          { id: 5, name: 'Reception', description: 'Front desk and customer service' },
          { id: 6, name: 'Management', description: 'Administrative and management roles' }
        ]
        
        const mockShifts = [
          { id: 1, name: 'Morning Shift', start_time: '08:00', end_time: '16:00' },
          { id: 2, name: 'Afternoon Shift', start_time: '12:00', end_time: '20:00' },
          { id: 3, name: 'Evening Shift', start_time: '16:00', end_time: '22:00' },
          { id: 4, name: 'Full Day', start_time: '09:00', end_time: '18:00' }
        ]
        
        const mockWorkers = [
          {
            id: 1,
            first_name: 'Adunni',
            last_name: 'Okafor',
            email: 'adunni.okafor@vonnesalon.com',
            phone: '+234 801 234 5678',
            department: 'Hair Styling',
            department_id: 1,
            position: 'Senior Hair Stylist',
            employee_id: 'VS001',
            hire_date: '2023-01-15',
            salary: 180000,
            commission_rate: 15,
            address: '123 Victoria Island, Lagos',
            emergency_contact: 'Kemi Okafor',
            emergency_phone: '+234 802 345 6789',
            skills: 'Hair cutting, Coloring, Braiding, Weaving',
            notes: 'Excellent with natural hair treatments',
            is_active: true,
            avatar: null,
            total_services: 245,
            total_revenue: 2450000,
            rating: 4.8,
            last_active: '2024-01-15T14:30:00Z',
            schedule: [
              { date: '2024-01-16', shift: 'Morning Shift', start_time: '08:00', end_time: '16:00' },
              { date: '2024-01-17', shift: 'Morning Shift', start_time: '08:00', end_time: '16:00' }
            ]
          },
          {
            id: 2,
            first_name: 'Chioma',
            last_name: 'Nwankwo',
            email: 'chioma.nwankwo@vonnesalon.com',
            phone: '+234 803 456 7890',
            department: 'Nail Care',
            department_id: 2,
            position: 'Nail Technician',
            employee_id: 'VS002',
            hire_date: '2023-03-20',
            salary: 150000,
            commission_rate: 12,
            address: '456 Lekki Phase 1, Lagos',
            emergency_contact: 'Emeka Nwankwo',
            emergency_phone: '+234 804 567 8901',
            skills: 'Manicure, Pedicure, Nail Art, Gel Polish',
            notes: 'Specializes in intricate nail designs',
            is_active: true,
            avatar: null,
            total_services: 189,
            total_revenue: 1890000,
            rating: 4.6,
            last_active: '2024-01-15T16:45:00Z',
            schedule: [
              { date: '2024-01-16', shift: 'Afternoon Shift', start_time: '12:00', end_time: '20:00' },
              { date: '2024-01-17', shift: 'Afternoon Shift', start_time: '12:00', end_time: '20:00' }
            ]
          },
          {
            id: 3,
            first_name: 'Fatima',
            last_name: 'Abdullahi',
            email: 'fatima.abdullahi@vonnesalon.com',
            phone: '+234 805 678 9012',
            department: 'Skin Care',
            department_id: 3,
            position: 'Esthetician',
            employee_id: 'VS003',
            hire_date: '2023-05-10',
            salary: 160000,
            commission_rate: 10,
            address: '789 Ikeja GRA, Lagos',
            emergency_contact: 'Amina Abdullahi',
            emergency_phone: '+234 806 789 0123',
            skills: 'Facial treatments, Chemical peels, Microdermabrasion',
            notes: 'Certified in advanced skin care techniques',
            is_active: true,
            avatar: null,
            total_services: 156,
            total_revenue: 1560000,
            rating: 4.9,
            last_active: '2024-01-15T13:20:00Z',
            schedule: [
              { date: '2024-01-16', shift: 'Full Day', start_time: '09:00', end_time: '18:00' },
              { date: '2024-01-17', shift: 'Full Day', start_time: '09:00', end_time: '18:00' }
            ]
          },
          {
            id: 4,
            first_name: 'Blessing',
            last_name: 'Okoro',
            email: 'blessing.okoro@vonnesalon.com',
            phone: '+234 807 890 1234',
            department: 'Reception',
            department_id: 5,
            position: 'Receptionist',
            employee_id: 'VS004',
            hire_date: '2023-07-01',
            salary: 120000,
            commission_rate: 0,
            address: '321 Surulere, Lagos',
            emergency_contact: 'Grace Okoro',
            emergency_phone: '+234 808 901 2345',
            skills: 'Customer service, Appointment scheduling, POS operations',
            notes: 'Excellent communication skills, fluent in English and Yoruba',
            is_active: true,
            avatar: null,
            total_services: 0,
            total_revenue: 0,
            rating: 4.7,
            last_active: '2024-01-15T17:00:00Z',
            schedule: [
              { date: '2024-01-16', shift: 'Full Day', start_time: '09:00', end_time: '18:00' },
              { date: '2024-01-17', shift: 'Full Day', start_time: '09:00', end_time: '18:00' }
            ]
          },
          {
            id: 5,
            first_name: 'Amara',
            last_name: 'Eze',
            email: 'amara.eze@vonnesalon.com',
            phone: '+234 809 012 3456',
            department: 'Makeup',
            department_id: 4,
            position: 'Makeup Artist',
            employee_id: 'VS005',
            hire_date: '2023-09-15',
            salary: 140000,
            commission_rate: 20,
            address: '654 Ajah, Lagos',
            emergency_contact: 'Chidi Eze',
            emergency_phone: '+234 810 123 4567',
            skills: 'Bridal makeup, Special effects, Color matching',
            notes: 'Specializes in bridal and event makeup',
            is_active: false,
            avatar: null,
            total_services: 78,
            total_revenue: 780000,
            rating: 4.5,
            last_active: '2024-01-10T12:00:00Z',
            schedule: []
          },
          {
            id: 6,
            first_name: 'Ngozi',
            last_name: 'Adebayo',
            email: 'ngozi.adebayo@vonnesalon.com',
            phone: '+234 811 234 5678',
            department: 'Hair Styling',
            department_id: 1,
            position: 'Junior Hair Stylist',
            employee_id: 'VS006',
            hire_date: '2023-11-01',
            salary: 130000,
            commission_rate: 8,
            address: '987 Maryland, Lagos',
            emergency_contact: 'Tunde Adebayo',
            emergency_phone: '+234 812 345 6789',
            skills: 'Basic cuts, Washing, Blow drying',
            notes: 'New hire, showing great potential',
            is_active: true,
            avatar: null,
            total_services: 45,
            total_revenue: 450000,
            rating: 4.2,
            last_active: '2024-01-15T15:30:00Z',
            schedule: [
              { date: '2024-01-16', shift: 'Evening Shift', start_time: '16:00', end_time: '22:00' },
              { date: '2024-01-17', shift: 'Evening Shift', start_time: '16:00', end_time: '22:00' }
            ]
          }
        ]
        
        setDepartments(mockDepartments)
        setShifts(mockShifts)
        setWorkers(mockWorkers)
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load workers data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const getFilteredWorkers = () => {
    let filtered = workers

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(worker =>
        `${worker.first_name} ${worker.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        worker.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        worker.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        worker.position.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by department
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(worker => worker.department_id === parseInt(selectedDepartment))
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(worker => {
        if (statusFilter === 'active') return worker.is_active
        if (statusFilter === 'inactive') return !worker.is_active
        return true
      })
    }

    // Sort workers
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
        case 'department':
          return a.department.localeCompare(b.department)
        case 'hire_date':
          return new Date(a.hire_date) - new Date(b.hire_date)
        case 'salary':
          return b.salary - a.salary
        case 'performance':
          return b.rating - a.rating
        default:
          return 0
      }
    })

    return filtered
  }

  const getWorkerStatus = (worker) => {
    if (!worker.is_active) {
      return { status: 'inactive', color: 'bg-gray-100 text-gray-800', label: 'Inactive' }
    }
    
    const lastActive = new Date(worker.last_active)
    const now = new Date()
    const hoursDiff = (now - lastActive) / (1000 * 60 * 60)
    
    if (hoursDiff < 1) {
      return { status: 'online', color: 'bg-green-100 text-green-800', label: 'Online' }
    } else if (hoursDiff < 24) {
      return { status: 'recent', color: 'bg-blue-100 text-blue-800', label: 'Recent' }
    } else {
      return { status: 'offline', color: 'bg-yellow-100 text-yellow-800', label: 'Offline' }
    }
  }

  const handleAddWorker = () => {
    setEditingWorker(null)
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      department_id: '',
      position: '',
      employee_id: '',
      hire_date: '',
      salary: '',
      commission_rate: '',
      address: '',
      emergency_contact: '',
      emergency_phone: '',
      skills: '',
      notes: '',
      is_active: true
    })
    setShowModal(true)
  }

  const handleEditWorker = (worker) => {
    setEditingWorker(worker)
    setFormData({
      first_name: worker.first_name,
      last_name: worker.last_name,
      email: worker.email,
      phone: worker.phone,
      department_id: worker.department_id.toString(),
      position: worker.position,
      employee_id: worker.employee_id,
      hire_date: worker.hire_date,
      salary: worker.salary.toString(),
      commission_rate: worker.commission_rate.toString(),
      address: worker.address,
      emergency_contact: worker.emergency_contact,
      emergency_phone: worker.emergency_phone,
      skills: worker.skills,
      notes: worker.notes,
      is_active: worker.is_active
    })
    setShowModal(true)
  }

  const handleScheduleWorker = (worker) => {
    setSchedulingWorker(worker)
    setScheduleData({
      worker_id: worker.id.toString(),
      shift_id: '',
      date: '',
      start_time: '',
      end_time: '',
      break_duration: '30',
      notes: ''
    })
    setShowScheduleModal(true)
  }

  const generateEmployeeId = () => {
    const department = departments.find(d => d.id === parseInt(formData.department_id))
    if (department) {
      const prefix = 'VS'
      const number = String(workers.length + 1).padStart(3, '0')
      setFormData(prev => ({ ...prev, employee_id: `${prefix}${number}` }))
    }
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validate form
      if (!formData.first_name || !formData.last_name || !formData.email || !formData.department_id) {
        toast.error('Please fill in all required fields')
        return
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        toast.error('Please enter a valid email address')
        return
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      const department = departments.find(d => d.id === parseInt(formData.department_id))

      const workerData = {
        ...formData,
        department_id: parseInt(formData.department_id),
        salary: parseInt(formData.salary) || 0,
        commission_rate: parseInt(formData.commission_rate) || 0,
        department: department?.name || '',
        id: editingWorker ? editingWorker.id : Date.now(),
        avatar: editingWorker ? editingWorker.avatar : null,
        total_services: editingWorker ? editingWorker.total_services : 0,
        total_revenue: editingWorker ? editingWorker.total_revenue : 0,
        rating: editingWorker ? editingWorker.rating : 0,
        last_active: editingWorker ? editingWorker.last_active : new Date().toISOString(),
        schedule: editingWorker ? editingWorker.schedule : []
      }

      if (editingWorker) {
        // Update existing worker
        setWorkers(prev => prev.map(worker => 
          worker.id === editingWorker.id ? workerData : worker
        ))
        toast.success('Worker updated successfully')
      } else {
        // Add new worker
        setWorkers(prev => [...prev, workerData])
        toast.success('Worker added successfully')
      }

      setShowModal(false)
    } catch (error) {
      console.error('Error saving worker:', error)
      toast.error('Failed to save worker. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleScheduleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (!scheduleData.date || !scheduleData.start_time || !scheduleData.end_time) {
        toast.error('Please fill in all required schedule fields')
        return
      }

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))

      const shift = shifts.find(s => s.id === parseInt(scheduleData.shift_id))
      const newScheduleEntry = {
        date: scheduleData.date,
        shift: shift?.name || 'Custom',
        start_time: scheduleData.start_time,
        end_time: scheduleData.end_time,
        break_duration: parseInt(scheduleData.break_duration),
        notes: scheduleData.notes
      }

      // Update worker schedule
      setWorkers(prev => prev.map(worker => 
        worker.id === schedulingWorker.id 
          ? { ...worker, schedule: [...worker.schedule, newScheduleEntry] }
          : worker
      ))

      toast.success('Schedule updated successfully')
      setShowScheduleModal(false)
    } catch (error) {
      console.error('Error updating schedule:', error)
      toast.error('Failed to update schedule. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteWorker = async (worker) => {
    if (!window.confirm(`Are you sure you want to delete "${worker.first_name} ${worker.last_name}"? This action cannot be undone.`)) {
      return
    }

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setWorkers(prev => prev.filter(w => w.id !== worker.id))
      toast.success('Worker deleted successfully')
    } catch (error) {
      console.error('Error deleting worker:', error)
      toast.error('Failed to delete worker')
    }
  }

  const filteredWorkers = getFilteredWorkers()
  const activeWorkers = workers.filter(w => w.is_active).length
  const totalSalaries = workers.filter(w => w.is_active).reduce((sum, w) => sum + w.salary, 0)
  const avgRating = workers.length > 0 ? workers.reduce((sum, w) => sum + w.rating, 0) / workers.length : 0
  const totalRevenue = workers.reduce((sum, w) => sum + w.total_revenue, 0)

  return (
    <DashboardLayout title="Worker Management">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Worker Management</h1>
              <p className="mt-2 text-gray-600">Manage your team members and their schedules</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <button
                onClick={handleAddWorker}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add New Worker
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('workers')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'workers'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Workers
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'schedule'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Schedule
              </button>
              <button
                onClick={() => setActiveTab('performance')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'performance'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Performance
              </button>
            </nav>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Workers</p>
                  <p className="text-2xl font-bold text-gray-900">{workers.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Workers</p>
                  <p className="text-2xl font-bold text-green-600">{activeWorkers}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Rating</p>
                  <p className="text-2xl font-bold text-blue-600">{avgRating.toFixed(1)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'workers' && (
            <>
              {/* Filters and Search */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Search */}
                  <div>
                    <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                      Search Workers
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Search by name, email, ID..."
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Department Filter */}
                  <div>
                    <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                      Department
                    </label>
                    <select
                      id="department"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="all">All Departments</option>
                      {departments.map(department => (
                        <option key={department.id} value={department.id}>{department.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      id="status"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
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
                      <option value="department">Department</option>
                      <option value="hire_date">Hire Date</option>
                      <option value="salary">Salary</option>
                      <option value="performance">Performance</option>
                    </select>
                  </div>

                  {/* Results Count */}
                  <div className="flex items-end">
                    <div className="text-sm text-gray-600">
                      <p>Showing: {filteredWorkers.length} of {workers.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Workers Grid */}
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <LoadingSpinner size="lg" text="Loading workers..." />
                </div>
              ) : filteredWorkers.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No workers found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm || selectedDepartment !== 'all' || statusFilter !== 'all'
                      ? 'Try adjusting your search or filter criteria.'
                      : 'Get started by adding your first worker.'
                    }
                  </p>
                  {!searchTerm && selectedDepartment === 'all' && statusFilter === 'all' && (
                    <div className="mt-6">
                      <button
                        onClick={handleAddWorker}
                        className="inline-flex items-center px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                      >
                        Add Your First Worker
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredWorkers.map((worker) => {
                    const status = getWorkerStatus(worker)
                    return (
                      <div key={worker.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center">
                            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-primary-600 font-medium text-lg">
                                {worker.first_name[0]}{worker.last_name[0]}
                              </span>
                            </div>
                            <div className="ml-3">
                              <h3 className="text-lg font-medium text-gray-900">
                                {worker.first_name} {worker.last_name}
                              </h3>
                              <p className="text-sm text-gray-500">{worker.position}</p>
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-gray-600">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                            </svg>
                            {worker.department}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {worker.employee_id}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {worker.email}
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {worker.phone}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mb-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-primary-600">{worker.total_services}</p>
                            <p className="text-xs text-gray-500">Services</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(worker.total_revenue)}</p>
                            <p className="text-xs text-gray-500">Revenue</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center">
                              <span className="text-2xl font-bold text-yellow-600">{worker.rating}</span>
                              <svg className="w-5 h-5 text-yellow-400 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </div>
                            <p className="text-xs text-gray-500">Rating</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between space-x-2">
                          <button
                            onClick={() => handleScheduleWorker(worker)}
                            className="flex-1 text-blue-600 hover:text-blue-900 text-sm font-medium py-2 px-3 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            Schedule
                          </button>
                          <button
                            onClick={() => handleEditWorker(worker)}
                            className="flex-1 text-primary-600 hover:text-primary-900 text-sm font-medium py-2 px-3 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteWorker(worker)}
                            className="text-red-600 hover:text-red-900 p-2 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete Worker"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">Weekly Schedule</h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Worker</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Monday</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Tuesday</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Wednesday</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Thursday</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Friday</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Saturday</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Sunday</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {workers.filter(w => w.is_active).map((worker) => (
                      <tr key={worker.id} className="hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                              <span className="text-primary-600 font-medium text-sm">
                                {worker.first_name[0]}{worker.last_name[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{worker.first_name} {worker.last_name}</p>
                              <p className="text-sm text-gray-500">{worker.position}</p>
                            </div>
                          </div>
                        </td>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                          const daySchedule = worker.schedule.find(s => {
                            const scheduleDate = new Date(s.date)
                            const dayName = scheduleDate.toLocaleDateString('en-US', { weekday: 'long' })
                            return dayName === day
                          })
                          
                          return (
                            <td key={day} className="py-4 px-4">
                              {daySchedule ? (
                                <div className="text-sm">
                                  <p className="font-medium text-gray-900">{daySchedule.shift}</p>
                                  <p className="text-gray-500">{daySchedule.start_time} - {daySchedule.end_time}</p>
                                </div>
                              ) : (
                                <span className="text-gray-400 text-sm">Off</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              {/* Performance Overview */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-6">Performance Overview</h3>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Worker
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Services
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Revenue
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rating
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Commission
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {workers.map((worker) => {
                        const commission = (worker.total_revenue * worker.commission_rate) / 100
                        const status = getWorkerStatus(worker)
                        
                        return (
                          <tr key={worker.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                                  <span className="text-primary-600 font-medium">
                                    {worker.first_name[0]}{worker.last_name[0]}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {worker.first_name} {worker.last_name}
                                  </div>
                                  <div className="text-sm text-gray-500">{worker.position}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {worker.total_services}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(worker.total_revenue)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="text-sm font-medium text-gray-900">{worker.rating}</span>
                                <svg className="w-4 h-4 text-yellow-400 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(commission)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Worker Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-xl bg-white">
            <form onSubmit={handleFormSubmit}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingWorker ? 'Edit Worker' : 'Add New Worker'}
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
                {/* First Name */}
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter first name"
                    required
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter last name"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter email address"
                    required
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="+234 xxx xxx xxxx"
                  />
                </div>

                {/* Department */}
                <div>
                  <label htmlFor="department_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Department *
                  </label>
                  <select
                    id="department_id"
                    value={formData.department_id}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, department_id: e.target.value }))
                      if (e.target.value && !editingWorker) {
                        generateEmployeeId()
                      }
                    }}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select Department</option>
                    {departments.map(department => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </div>

                {/* Position */}
                <div>
                  <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-2">
                    Position
                  </label>
                  <input
                    type="text"
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter position/title"
                  />
                </div>

                {/* Employee ID */}
                <div>
                  <label htmlFor="employee_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    id="employee_id"
                    value={formData.employee_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, employee_id: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Auto-generated or custom"
                  />
                </div>

                {/* Hire Date */}
                <div>
                  <label htmlFor="hire_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Hire Date
                  </label>
                  <input
                    type="date"
                    id="hire_date"
                    value={formData.hire_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, hire_date: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                {/* Salary */}
                <div>
                  <label htmlFor="salary" className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Salary (₦)
                  </label>
                  <input
                    type="number"
                    id="salary"
                    value={formData.salary}
                    onChange={(e) => setFormData(prev => ({ ...prev, salary: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="150000"
                    min="0"
                  />
                </div>

                {/* Commission Rate */}
                <div>
                  <label htmlFor="commission_rate" className="block text-sm font-medium text-gray-700 mb-2">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    id="commission_rate"
                    value={formData.commission_rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, commission_rate: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="10"
                    min="0"
                    max="100"
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter home address"
                  />
                </div>

                {/* Emergency Contact */}
                <div>
                  <label htmlFor="emergency_contact" className="block text-sm font-medium text-gray-700 mb-2">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    id="emergency_contact"
                    value={formData.emergency_contact}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Contact person name"
                  />
                </div>

                {/* Emergency Phone */}
                <div>
                  <label htmlFor="emergency_phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Emergency Contact Phone
                  </label>
                  <input
                    type="tel"
                    id="emergency_phone"
                    value={formData.emergency_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, emergency_phone: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="+234 xxx xxx xxxx"
                  />
                </div>

                {/* Skills */}
                <div className="md:col-span-2">
                  <label htmlFor="skills" className="block text-sm font-medium text-gray-700 mb-2">
                    Skills & Specializations
                  </label>
                  <textarea
                    id="skills"
                    value={formData.skills}
                    onChange={(e) => setFormData(prev => ({ ...prev, skills: e.target.value }))}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="List skills, certifications, and specializations..."
                  />
                </div>

                {/* Notes */}
                <div className="lg:col-span-3">
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Additional notes about the worker..."
                  />
                </div>

                {/* Active Status */}
                <div className="lg:col-span-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                      Active Employee
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <ButtonSpinner size="sm" />
                      <span className="ml-2">{editingWorker ? 'Updating...' : 'Adding...'}</span>
                    </>
                  ) : (
                    editingWorker ? 'Update Worker' : 'Add Worker'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-xl bg-white">
            <form onSubmit={handleScheduleSubmit}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-medium text-gray-900">
                  Schedule Worker: {schedulingWorker?.first_name} {schedulingWorker?.last_name}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date */}
                <div>
                  <label htmlFor="schedule_date" className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    id="schedule_date"
                    value={scheduleData.date}
                    onChange={(e) => setScheduleData(prev => ({ ...prev, date: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                {/* Shift */}
                <div>
                  <label htmlFor="shift_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Shift Template
                  </label>
                  <select
                    id="shift_id"
                    value={scheduleData.shift_id}
                    onChange={(e) => {
                      const shift = shifts.find(s => s.id === parseInt(e.target.value))
                      setScheduleData(prev => ({
                        ...prev,
                        shift_id: e.target.value,
                        start_time: shift?.start_time || '',
                        end_time: shift?.end_time || ''
                      }))
                    }}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Custom Schedule</option>
                    {shifts.map(shift => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name} ({shift.start_time} - {shift.end_time})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Start Time */}
                <div>
                  <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    id="start_time"
                    value={scheduleData.start_time}
                    onChange={(e) => setScheduleData(prev => ({ ...prev, start_time: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                {/* End Time */}
                <div>
                  <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-2">
                    End Time *
                  </label>
                  <input
                    type="time"
                    id="end_time"
                    value={scheduleData.end_time}
                    onChange={(e) => setScheduleData(prev => ({ ...prev, end_time: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>

                {/* Break Duration */}
                <div>
                  <label htmlFor="break_duration" className="block text-sm font-medium text-gray-700 mb-2">
                    Break Duration (minutes)
                  </label>
                  <input
                    type="number"
                    id="break_duration"
                    value={scheduleData.break_duration}
                    onChange={(e) => setScheduleData(prev => ({ ...prev, break_duration: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    min="0"
                    max="120"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label htmlFor="schedule_notes" className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    id="schedule_notes"
                    value={scheduleData.notes}
                    onChange={(e) => setScheduleData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={3}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Special instructions or notes for this schedule..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isSubmitting ? (
                    <>
                      <ButtonSpinner size="sm" />
                      <span className="ml-2">Scheduling...</span>
                    </>
                  ) : (
                    'Add to Schedule'
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

export default Workers