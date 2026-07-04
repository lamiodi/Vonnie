import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiPut, API_ENDPOINTS } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { handleError, handleSuccess } from '../utils/errorHandler';
import toast from 'react-hot-toast';

// ============================================
// Admin Attendance View Component
// ============================================
const AdminAttendanceView = () => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    workerId: '',
    status: ''
  });

  useEffect(() => {
    fetchWorkers();
    fetchAttendanceRecords();
  }, []);

  const fetchWorkers = async () => {
    try {
      const response = await apiGet(API_ENDPOINTS.WORKERS);
      const workerList = Array.isArray(response) ? response : (response.data || []);
      setWorkers(workerList.filter(w => w.role !== 'admin'));
    } catch (error) {
      console.error('Failed to fetch workers:', error);
    }
  };

  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.startDate) params.start_date = filters.startDate;
      if (filters.endDate) params.end_date = filters.endDate;
      if (filters.workerId) params.worker_id = filters.workerId;
      if (filters.status && filters.status !== 'absent') params.status = filters.status;

      const response = await apiGet(API_ENDPOINTS.ATTENDANCE, params);
      setAttendanceRecords(Array.isArray(response) ? response : (response.data || []));
    } catch (error) {
      handleError(error, 'Failed to fetch attendance records');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Build today's summary: which workers checked in, who hasn't
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = attendanceRecords.filter(r => {
    const recordDate = new Date(r.date).toISOString().split('T')[0];
    return recordDate === todayStr;
  });

  const checkedInWorkerIds = new Set(todayRecords.map(r => r.worker_id));
  const presentWorkers = workers.filter(w => checkedInWorkerIds.has(w.id));
  const absentWorkers = workers.filter(w => !checkedInWorkerIds.has(w.id) && w.status !== 'inactive');

  const navigate = useNavigate();

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2">Attendance Management</h1>
          <p className="text-sm sm:text-base text-gray-600">Track and monitor worker attendance records</p>
        </div>
        <button
          onClick={() => window.open('https://vonneex2x.store/attendance-kiosk', '_blank', 'noopener,noreferrer')}
          className="bg-gray-900 text-white px-5 py-2.5 rounded-lg hover:bg-black font-medium shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95"
        >
          <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
          </svg>
          Open Kiosk Mode
        </button>
      </div>

      {/* Today's Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center border-t-4 border-blue-500">
          <div className="text-2xl sm:text-3xl font-bold text-blue-600">{workers.filter(w => w.status !== 'inactive').length}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Total Workers</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center border-t-4 border-green-500">
          <div className="text-2xl sm:text-3xl font-bold text-green-600">{presentWorkers.length}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Present Today</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center border-t-4 border-yellow-500">
          <div className="text-2xl sm:text-3xl font-bold text-yellow-600">
            {todayRecords.filter(r => r.status === 'late').length}
          </div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1 uppercase font-semibold">Late Today</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center border-t-4 border-red-500">
          <div className="text-2xl sm:text-3xl font-bold text-red-600">{absentWorkers.length}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Absent Today</div>
        </div>
      </div>

      {/* Today's Worker Status Cards */}
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6 mb-6">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-4">Today's Worker Status</h2>

        {workers.filter(w => w.status !== 'inactive').length === 0 ? (
          <p className="text-gray-500 text-sm">No workers found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {workers.filter(w => w.status !== 'inactive').map(worker => {
              const record = todayRecords.find(r => r.worker_id === worker.id);
              const isPresent = !!record;
              const hasCheckedOut = record?.check_out_time;

              return (
                <div key={worker.id} className={`rounded-lg border-2 p-3 sm:p-4 transition-all ${hasCheckedOut
                  ? 'border-gray-200 bg-gray-50'
                  : isPresent
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                  }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${hasCheckedOut ? 'bg-gray-400' : isPresent ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                      <span className="font-medium text-gray-900 text-sm sm:text-base truncate">{worker.name}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${hasCheckedOut
                      ? 'bg-gray-100 text-gray-700'
                      : isPresent
                        ? record.status === 'late'
                          ? 'bg-yellow-100 text-yellow-800'
                          : record.status === 'flagged'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                      }`}>
                      {hasCheckedOut ? 'Left' : isPresent ? (record.status || 'Present') : 'Absent'}
                    </span>
                  </div>
                  {isPresent && (
                    <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Check-in:</span>
                        <span className="font-medium flex items-center gap-1">
                          {formatTime(record.check_in_time)}
                        </span>
                      </div>
                      {record.check_out_time && (
                        <div className="flex justify-between">
                          <span>Check-out:</span>
                          <span className="font-medium flex items-center gap-1">
                            {formatTime(record.check_out_time)}
                          </span>
                        </div>
                      )}
                      {record.location_verification_status && (
                        <div className="flex justify-between">
                          <span>Location:</span>
                          <span className={`text-xs font-medium ${record.location_verification_status === 'verified' ? 'text-green-600' :
                            record.location_verification_status === 'rejected' ? 'text-red-600' :
                              'text-yellow-600'
                            }`}>
                            {record.location_verification_status === 'verified' ? '✓ Verified' :
                              record.location_verification_status === 'rejected' ? '✗ Rejected' :
                                '⚠ Flagged'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {!isPresent && (
                    <div className="text-xs text-gray-500 mt-1">
                      {worker.role && <span className="capitalize">{worker.role}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6 mb-6">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-4">Filter Records</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">Worker</label>
            <select
              value={filters.workerId}
              onChange={(e) => setFilters({ ...filters, workerId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Workers</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select
              value={filters.status || ''}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="flagged">Flagged</option>
              <option value="absent">Absent (Calculated)</option>
            </select>
          </div>
          <div className="flex items-end lg:col-span-4">
            <button
              onClick={fetchAttendanceRecords}
              className="w-full bg-blue-600 text-white px-4 py-2 text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm active:scale-95 transition-transform"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Records Table/Cards */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800">Attendance History</h2>
          <span className="text-xs sm:text-sm text-gray-500">{attendanceRecords.length} record(s)</span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">
            <svg className="animate-spin h-6 w-6 mx-auto mb-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading attendance records...
          </div>
        ) : attendanceRecords.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No attendance records found for the selected filters.</div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-gray-200">
              {attendanceRecords.map((record) => (
                <div key={record.id} className="p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate">{record.name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{formatDate(record.date)}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${record.status === 'present' ? 'bg-green-100 text-green-800' :
                      record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                        record.status === 'flagged' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                      }`}>
                      {record.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="text-gray-500">In: </span>
                      <span className="font-medium">{formatTime(record.check_in_time)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Out: </span>
                      <span className="font-medium">{formatTime(record.check_out_time)}</span>
                    </div>
                  </div>
                  {record.location_verification_status && (
                    <div className="mt-1.5 text-xs">
                      <span className={`inline-flex items-center gap-1 ${record.location_verification_status === 'verified' ? 'text-green-600' :
                        record.location_verification_status === 'rejected' ? 'text-red-600' :
                          'text-yellow-600'
                        }`}>
                        {record.location_verification_status === 'verified' ? '✓ Location Verified' :
                          record.location_verification_status === 'rejected' ? '✗ Location Rejected' :
                            '⚠ Location Flagged'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Worker</th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Location</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(record.date)}</td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{record.name || 'Unknown'}</td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(record.check_in_time)}
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(record.check_out_time) || '-'}
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'present' ? 'bg-green-100 text-green-800' :
                          record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                            record.status === 'flagged' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                          }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                        {record.location_verification_status === 'verified' ? (
                          <span className="text-green-600 flex items-center"><span className="mr-1">✓</span> Verified</span>
                        ) : record.location_verification_status === 'rejected' ? (
                          <span className="text-red-600 flex items-center"><span className="mr-1">✗</span> Rejected</span>
                        ) : record.location_verification_status === 'flagged' ? (
                          <span className="text-yellow-600 flex items-center"><span className="mr-1">⚠</span> Flagged</span>
                        ) : (
                          <span className="text-gray-400">No Data</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Time-Off & Correction Request Management */}
      <div className="mt-6">
        <RequestManagement />
      </div>
    </div>
  );
};

// ============================================
// Time-Off & Correction Request Management
// ============================================
const RequestManagement = () => {
  const [activeRequestTab, setActiveRequestTab] = useState('time-off');
  const [timeOffRequests, setTimeOffRequests] = useState([]);
  const [correctionRequests, setCorrectionRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [showTimeOffForm, setShowTimeOffForm] = useState(false);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [workers, setWorkers] = useState([]);

  const [timeOffForm, setTimeOffForm] = useState({
    worker_id: '', start_date: '', end_date: '', reason: '', type: 'time_off'
  });
  const [correctionForm, setCorrectionForm] = useState({
    worker_id: '', date: '', requested_check_in: '', requested_check_out: '', reason: ''
  });

  useEffect(() => {
    fetchWorkers();
    fetchRequests();
  }, []);

  const fetchWorkers = async () => {
    try {
      const res = await apiGet(API_ENDPOINTS.WORKERS);
      setWorkers(Array.isArray(res) ? res : (res.data || []));
    } catch (e) { console.error('Failed to fetch workers:', e); }
  };

  const fetchRequests = async () => {
    setRequestsLoading(true);
    try {
      const [torRes, crRes] = await Promise.all([
        apiGet(API_ENDPOINTS.ATTENDANCE_TIME_OFF),
        apiGet(API_ENDPOINTS.ATTENDANCE_CORRECTIONS)
      ]);
      setTimeOffRequests(Array.isArray(torRes) ? torRes : []);
      setCorrectionRequests(Array.isArray(crRes) ? crRes : []);
    } catch (e) { console.error('Failed to fetch requests:', e); }
    setRequestsLoading(false);
  };

  const handleTimeOffSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiPost(API_ENDPOINTS.ATTENDANCE_TIME_OFF, timeOffForm);
      toast.success('Time-off request submitted');
      setShowTimeOffForm(false);
      setTimeOffForm({ worker_id: '', start_date: '', end_date: '', reason: '', type: 'time_off' });
      fetchRequests();
    } catch (err) {
      toast.error('Failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiPost(API_ENDPOINTS.ATTENDANCE_CORRECTION, correctionForm);
      toast.success('Correction request submitted');
      setShowCorrectionForm(false);
      setCorrectionForm({ worker_id: '', date: '', requested_check_in: '', requested_check_out: '', reason: '' });
      fetchRequests();
    } catch (err) {
      toast.error('Failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleTimeOffReview = async (id, status) => {
    try {
      await apiPut(API_ENDPOINTS.ATTENDANCE_TIME_OFF_UPDATE(id), { status });
      toast.success(`Request ${status}`);
      fetchRequests();
    } catch (err) {
      toast.error('Failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCorrectionReview = async (id, status) => {
    try {
      await apiPut(API_ENDPOINTS.ATTENDANCE_CORRECTION_UPDATE(id), { status });
      toast.success(`Request ${status}`);
      fetchRequests();
    } catch (err) {
      toast.error('Failed: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveRequestTab('time-off')}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${activeRequestTab === 'time-off' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            🏖️ Time-Off Requests
          </button>
          <button
            onClick={() => setActiveRequestTab('corrections')}
            className={`px-4 py-3 text-sm font-medium border-b-2 ${activeRequestTab === 'corrections' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            ✏️ Correction Requests
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeRequestTab === 'time-off' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Time-Off Requests</h3>
              <button
                onClick={() => setShowTimeOffForm(true)}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
              >
                + New Request
              </button>
            </div>

            {showTimeOffForm && (
              <form onSubmit={handleTimeOffSubmit} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Worker</label>
                    <select value={timeOffForm.worker_id} onChange={e => setTimeOffForm(p => ({...p, worker_id: e.target.value}))} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                      <option value="">Select worker</option>
                      {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                    <select value={timeOffForm.type} onChange={e => setTimeOffForm(p => ({...p, type: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                      <option value="time_off">Time Off</option>
                      <option value="sick_leave">Sick Leave</option>
                      <option value="vacation">Vacation</option>
                      <option value="emergency">Emergency</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                    <input type="date" value={timeOffForm.start_date} onChange={e => setTimeOffForm(p => ({...p, start_date: e.target.value}))} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                    <input type="date" value={timeOffForm.end_date} onChange={e => setTimeOffForm(p => ({...p, end_date: e.target.value}))} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
                  <textarea value={timeOffForm.reason} onChange={e => setTimeOffForm(p => ({...p, reason: e.target.value}))} required rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Explain the reason for time off..." />
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowTimeOffForm(false)} className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-100">Cancel</button>
                  <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Submit</button>
                </div>
              </form>
            )}

            {requestsLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>
            ) : timeOffRequests.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No time-off requests</p>
            ) : (
              <div className="space-y-2">
                {timeOffRequests.map(req => (
                  <div key={req.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{req.worker_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          req.status === 'approved' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>{req.status}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{req.type}</span>
                      </div>
                      <p className="text-sm text-gray-600">{req.start_date} → {req.end_date}</p>
                      <p className="text-xs text-gray-500 mt-1">{req.reason}</p>
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleTimeOffReview(req.id, 'approved')} className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">Approve</button>
                        <button onClick={() => handleTimeOffReview(req.id, 'rejected')} className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeRequestTab === 'corrections' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Attendance Correction Requests</h3>
              <button
                onClick={() => setShowCorrectionForm(true)}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
              >
                + New Request
              </button>
            </div>

            {showCorrectionForm && (
              <form onSubmit={handleCorrectionSubmit} className="bg-gray-50 rounded-lg p-4 mb-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Worker</label>
                    <select value={correctionForm.worker_id} onChange={e => setCorrectionForm(p => ({...p, worker_id: e.target.value}))} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                      <option value="">Select worker</option>
                      {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" value={correctionForm.date} onChange={e => setCorrectionForm(p => ({...p, date: e.target.value}))} required className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Requested Check-In</label>
                    <input type="time" value={correctionForm.requested_check_in} onChange={e => setCorrectionForm(p => ({...p, requested_check_in: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Requested Check-Out</label>
                    <input type="time" value={correctionForm.requested_check_out} onChange={e => setCorrectionForm(p => ({...p, requested_check_out: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
                  <textarea value={correctionForm.reason} onChange={e => setCorrectionForm(p => ({...p, reason: e.target.value}))} required rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="Explain the correction needed..." />
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowCorrectionForm(false)} className="px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-100">Cancel</button>
                  <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Submit</button>
                </div>
              </form>
            )}

            {requestsLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div></div>
            ) : correctionRequests.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No correction requests</p>
            ) : (
              <div className="space-y-2">
                {correctionRequests.map(req => (
                  <div key={req.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{req.worker_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          req.status === 'approved' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>{req.status}</span>
                      </div>
                      <p className="text-sm text-gray-600">Date: {req.date}</p>
                      {req.existing_check_in && <p className="text-xs text-gray-500">Current: In {req.existing_check_in ? new Date(req.existing_check_in).toLocaleTimeString() : '-'} / Out {req.existing_check_out ? new Date(req.existing_check_out).toLocaleTimeString() : '-'}</p>}
                      {req.requested_check_in && <p className="text-xs text-blue-600">Requested: In {req.requested_check_in} / Out {req.requested_check_out}</p>}
                      <p className="text-xs text-gray-500 mt-1">{req.reason}</p>
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleCorrectionReview(req.id, 'approved')} className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700">Approve</button>
                        <button onClick={() => handleCorrectionReview(req.id, 'rejected')} className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// Worker Attendance View Component
// ============================================
const WorkerAttendanceView = () => {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    workerId: ''
  });

  useEffect(() => {
    fetchAttendanceRecords();
    const checkMobile = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 0 && navigator.maxTouchPoints <= 2);
      setIsMobileDevice(isMobile);
    };
    checkMobile();
  }, []);

  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.startDate) params.start_date = filters.startDate;
      if (filters.endDate) params.end_date = filters.endDate;
      if (filters.workerId) params.worker_id = filters.workerId;

      const response = await apiGet(API_ENDPOINTS.ATTENDANCE, params);
      setAttendanceRecords(Array.isArray(response) ? response : (response.data || []));
    } catch (error) {
      handleError(error, 'Failed to fetch attendance records');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      const response = await apiPost(API_ENDPOINTS.ATTENDANCE_CHECKIN, {
        worker_id: user.id
      });
      handleSuccess('Check-in successful');
      fetchAttendanceRecords();
    } catch (error) {
      handleError(error, 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setCheckingOut(true);
      await apiPost(API_ENDPOINTS.ATTENDANCE_CHECKOUT, {
        worker_id: user.id
      });
      handleSuccess('Check-out successful');
      fetchAttendanceRecords();
    } catch (error) {
      handleError(error, 'Check-out failed');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleFingerprintCheckIn = async () => {
    try {
      setCheckingIn(true);

      // 1. Capture the live finger from the local bridge
      const FINGERPRINT_BRIDGE_URL = import.meta.env.VITE_FINGERPRINT_BRIDGE_URL || 'http://127.0.0.1:8081';
      const localResponse = await fetch(`${FINGERPRINT_BRIDGE_URL}/api/capture`);
      if (!localResponse.ok) {
        throw new Error('Could not connect to local fingerprint scanner');
      }

      const captureData = await localResponse.json();

      // For this implementation, we are sending the worker ID to verify.
      // A more advanced bridge could match it locally.
      const response = await apiPost('/attendance/verify-fingerprint', {
        worker_id: user.id,
        fingerprint_data: captureData.template
      });

      handleSuccess('Check-in via fingerprint successful');
      fetchAttendanceRecords();
    } catch (error) {
      handleError(error, 'Fingerprint Check-in failed. Is the ZKTeco bridge running?');
    } finally {
      setCheckingIn(false);
    }
  };

  const formatTime = (timeString) => {
    if (!timeString) return '-';
    return new Date(timeString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTodayAttendance = () => {
    const today = new Date().toISOString().split('T')[0];
    return attendanceRecords.find(record => {
      const recordDate = new Date(record.date).toISOString().split('T')[0];
      return recordDate === today && record.worker_id === user.id;
    });
  };

  const todayAttendance = getTodayAttendance();

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2">Attendance</h1>

        {/* Guidelines Section */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 sm:p-4 mb-4 rounded-r-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-xs sm:text-sm font-medium text-blue-800">Attendance Guidelines</h3>
              <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-blue-700">
                <ul className="list-disc pl-4 sm:pl-5 space-y-0.5 sm:space-y-1">
                  <li><strong>Check-In:</strong> Use the kiosk or fingerprint scanner to mark attendance.</li>
                  <li><strong>One Check-In Per Day:</strong> You can only check in once per day.</li>
                  <li><strong>Check-Out:</strong> Don't forget to check out when you leave!</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Attendance Status */}
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">Today's Attendance</h2>

        {todayAttendance ? (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-sm sm:text:base text-gray-600 font-medium">Status:</span>
              <span className={`px-3 py-1 rounded-full text-xs sm:text:s font-medium w-fit ${todayAttendance.status === 'present' ? 'bg-green-100 text-green-800' :
                todayAttendance.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                  todayAttendance.status === 'flagged' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                }`}>
                {todayAttendance.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-gray-50 p-3 rounded-md">
                <span className="text-gray-600 text-xs sm:text:s block mb-1">Check-in:</span>
                <p className="font-semibold text-sm sm:text:base text-gray-900">{formatTime(todayAttendance.check_in_time)}</p>
              </div>

              {todayAttendance.check_out_time && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <span className="text-gray-600 text-xs sm:text:s block mb-1">Check-out:</span>
                  <p className="font-semibold text-sm sm:text:base text-gray-900">{formatTime(todayAttendance.check_out_time)}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-xs sm:text:s md:text:base">No attendance record for today</p>
        )}

        {/* Action Buttons */}
        <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
          {!todayAttendance?.check_in_time && (
            <>
              {/* Kiosk Link - check in/out via the fingerprint kiosk */}
              <a
                href="https://vonneex2x.store/attendance-kiosk"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-teal-600 text-white px-4 py-2.5 sm:py-3 rounded-lg hover:bg-teal-700 flex items-center justify-center text-sm sm:text:base font-medium shadow-sm active:scale-95 transition-transform"
              >
                Check In via Kiosk
              </a>

              {/* Desktop / Shop PC Biometric Option */}
              {!isMobileDevice && (
                <button
                  onClick={handleFingerprintCheckIn}
                  disabled={checkingIn}
                  className="w-full bg-teal-600 text-white px-4 py-2.5 sm:py-3 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm sm:text:base font-medium shadow-sm active:scale-95 transition-transform mt-2"
                >
                  Scan Fingerprint (Shop PC)
                </button>
              )}
            </>
          )}

          {todayAttendance?.check_in_time && (
            <button
              onClick={handleCheckOut}
              disabled={checkingOut || !!todayAttendance.check_out_time}
              className={`w-full text-white px-4 py-2.5 sm:py-3 rounded-lg flex items-center justify-center text-sm sm:text:base font-medium shadow-sm active:scale-95 transition-transform ${todayAttendance.check_out_time
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
                }`}
            >
              {todayAttendance.check_out_time
                ? 'Checked Out'
                : checkingOut
                  ? 'Checking out...'
                  : 'Check Out'}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text:s font-medium text-gray-700 mb-1.5">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs sm:text:s font-medium text-gray-700 mb-1.5">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchAttendanceRecords}
              className="w-full bg-blue-600 text-white px-4 py-2 text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm active:scale-95 transition-transform"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Records */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800">Attendance History</h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading attendance records...</div>
        ) : attendanceRecords.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No attendance records found</div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden divide-y divide-gray-200">
              {attendanceRecords.map((record) => (
                <div key={record.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{formatDate(record.date)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${record.status === 'present' ? 'bg-green-100 text-green-800' :
                      record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                        record.status === 'flagged' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                      }`}>
                      {record.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="text-gray-500">In: </span>
                      <span className="font-medium">{formatTime(record.check_in_time)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Out: </span>
                      <span className="font-medium">{formatTime(record.check_out_time)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Worker</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Location</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(record.date)}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.name}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(record.check_in_time)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(record.check_out_time) || '-'}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'present' ? 'bg-green-100 text-green-800' :
                          record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                            record.status === 'flagged' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                          }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                        {record.location_verification_status === 'verified' ? (
                          <span className="text-green-600 flex items-center"><span className="mr-1">✓</span> Verified</span>
                        ) : record.location_verification_status === 'rejected' ? (
                          <span className="text-red-600 flex items-center"><span className="mr-1">✗</span> Rejected</span>
                        ) : record.location_verification_status === 'flagged' ? (
                          <span className="text-yellow-600 flex items-center"><span className="mr-1">⚠</span> Flagged</span>
                        ) : (
                          <span className="text-gray-400">No Data</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================
// Main Attendance Component (Router)
// ============================================
const Attendance = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  if (isAdmin) {
    return <AdminAttendanceView />;
  }

  return <WorkerAttendanceView />;
};

export default Attendance;