import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, API_ENDPOINTS } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { handleError, handleSuccess } from '../utils/errorHandler';

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
    workerId: ''
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

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2">Attendance Management</h1>
        <p className="text-sm sm:text-base text-gray-600">Track and monitor worker attendance records</p>
      </div>

      {/* Today's Snapshot */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center">
          <div className="text-2xl sm:text-3xl font-bold text-blue-600">{workers.filter(w => w.status !== 'inactive').length}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Total Workers</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center">
          <div className="text-2xl sm:text-3xl font-bold text-green-600">{presentWorkers.length}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Present Today</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center">
          <div className="text-2xl sm:text-3xl font-bold text-red-600">{absentWorkers.length}</div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Absent Today</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 text-center">
          <div className="text-2xl sm:text-3xl font-bold text-yellow-600">
            {todayRecords.filter(r => r.status === 'late' || r.status === 'flagged').length}
          </div>
          <div className="text-xs sm:text-sm text-gray-600 mt-1">Late/Flagged</div>
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
                          {record.gps_check_in_verified && <span className="text-green-600 text-xs">✓</span>}
                        </span>
                      </div>
                      {record.check_out_time && (
                        <div className="flex justify-between">
                          <span>Check-out:</span>
                          <span className="font-medium flex items-center gap-1">
                            {formatTime(record.check_out_time)}
                            {record.gps_check_out_verified && <span className="text-green-600 text-xs">✓</span>}
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
                      {record.gps_check_in_verified && <span className="text-green-600 ml-1">✓</span>}
                    </div>
                    <div>
                      <span className="text-gray-500">Out: </span>
                      <span className="font-medium">{formatTime(record.check_out_time)}</span>
                      {record.gps_check_out_verified && <span className="text-green-600 ml-1">✓</span>}
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
                    <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(record.date)}</td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{record.name || 'Unknown'}</td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(record.check_in_time)}
                        {record.gps_check_in_verified && (
                          <span className="ml-2 text-xs text-green-600">✓ GPS</span>
                        )}
                      </td>
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(record.check_out_time)}
                        {record.gps_check_out_verified && (
                          <span className="ml-2 text-xs text-green-600">✓ GPS</span>
                        )}
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
                      <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
// Worker Attendance View Component
// ============================================
const WorkerAttendanceView = () => {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
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

  const getCurrentLocation = (retries = 3) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      setLocationLoading(true);
      setLocationError('');

      const success = (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        if (position.coords.accuracy > 100 && retries > 0) {
          console.log(`GPS accuracy poor (${position.coords.accuracy}m), retrying...`);
          setTimeout(() => {
            getCurrentLocation(retries - 1).then(resolve).catch(reject);
          }, 1000);
          return;
        }

        setCurrentLocation(location);
        setLocationLoading(false);
        resolve(location);
      };

      const error = (err) => {
        if (retries > 0) {
          console.log(`GPS error (${err.code}), retrying...`);
          setTimeout(() => {
            getCurrentLocation(retries - 1).then(resolve).catch(reject);
          }, 1000);
          return;
        }

        setLocationLoading(false);
        let errorMessage = 'Failed to get location';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location services in your browser settings.';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable. Try moving to an area with better signal (near a window/outside).';
            break;
          case err.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
        }
        setLocationError(errorMessage);
        reject(new Error(errorMessage));
      };

      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(success, error, options);
    });
  };

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      setLocationError('');

      let locationData = {};

      try {
        const location = await getCurrentLocation();
        locationData = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy
        };
      } catch (locationError) {
        console.warn('GPS location not available:', locationError.message);
        if (!isMobileDevice || manualOverride) {
          setLocationError('Check-in recorded without GPS verification (Desktop mode)');
        } else {
          setLocationError('Check-in without GPS - location verification disabled');
        }
      }

      const response = await apiPost(API_ENDPOINTS.ATTENDANCE_CHECKIN, {
        worker_id: user.id,
        ...locationData
      });

      const responseData = response.data || response;
      if (responseData.location_verification_status === 'rejected') {
        setLocationError('Unable to verify attendance. You appear to be outside the shop. Please ensure you are inside the shop to mark attendance.');
      } else if (responseData.location_verification_status === 'verified') {
        setLocationError('');
      }

      handleSuccess('Check-in successful');
      fetchAttendanceRecords();
      setCurrentLocation(null);
    } catch (error) {
      handleError(error, 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setCheckingOut(true);
      setLocationError('');

      let locationData = {};

      try {
        const location = await getCurrentLocation();
        locationData = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy
        };
      } catch (locationError) {
        console.warn('GPS location not available:', locationError.message);
        if (!isMobileDevice || manualOverride) {
          setLocationError('Check-out recorded without GPS verification (Desktop mode)');
        } else {
          setLocationError('Check-out without GPS - location verification disabled');
        }
      }

      await apiPost(API_ENDPOINTS.ATTENDANCE_CHECKOUT, {
        worker_id: user.id,
        ...locationData
      });

      handleSuccess('Check-out successful');
      fetchAttendanceRecords();
      setCurrentLocation(null);
    } catch (error) {
      handleError(error, 'Check-out failed');
    } finally {
      setCheckingOut(false);
    }
  };

  const verifyLocation = async () => {
    try {
      setLocationLoading(true);
      const location = await getCurrentLocation();

      const response = await apiPost(API_ENDPOINTS.ATTENDANCE_VERIFY, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        worker_id: user.id
      });

      const responseData = response.data || response;
      if (responseData.verified) {
        handleSuccess(`Location verified - you are within ${responseData.distance_meters}m of business`);
      } else {
        setLocationError(`Too far from business location - ${responseData.distance_meters}m away (max: ${responseData.max_allowed_distance}m)`);
      }
    } catch (error) {
      handleError(error, 'Location verification failed');
    } finally {
      setLocationLoading(false);
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
                  <li><strong>Check-In:</strong> You must be within 500 meters of the shop. Enable GPS on your device.</li>
                  <li><strong>One Check-In Per Day:</strong> You can only check in once per day.</li>
                  <li><strong>Check-Out:</strong> Don't forget to check out when you leave!</li>
                  <li><strong>Troubleshooting:</strong> If GPS fails, try moving near a window or going outside.</li>
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
              <span className="text-sm sm:text-base text-gray-600 font-medium">Status:</span>
              <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium w-fit ${todayAttendance.status === 'present' ? 'bg-green-100 text-green-800' :
                  todayAttendance.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                    todayAttendance.status === 'flagged' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                }`}>
                {todayAttendance.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-gray-50 p-3 rounded-md">
                <span className="text-gray-600 text-xs sm:text-sm block mb-1">Check-in:</span>
                <p className="font-semibold text-sm sm:text-base text-gray-900">{formatTime(todayAttendance.check_in_time)}</p>
                {todayAttendance.gps_check_in_verified && (
                  <span className="text-xs text-green-600 flex items-center mt-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                    Location Verified
                  </span>
                )}
              </div>

              {todayAttendance.check_out_time && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <span className="text-gray-600 text-xs sm:text-sm block mb-1">Check-out:</span>
                  <p className="font-semibold text-sm sm:text-base text-gray-900">{formatTime(todayAttendance.check_out_time)}</p>
                  {todayAttendance.gps_check_out_verified && (
                    <span className="text-xs text-green-600 flex items-center mt-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                      Location Verified
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-gray-600">Location Status:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${todayAttendance.location_verification_status === 'verified' ? 'bg-green-100 text-green-800' :
                    todayAttendance.location_verification_status === 'rejected' ? 'bg-red-100 text-red-800' :
                      todayAttendance.location_verification_status === 'flagged' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                  }`}>
                  {todayAttendance.location_verification_status === 'verified' ? 'Verified' :
                    todayAttendance.location_verification_status === 'rejected' ? 'Rejected' :
                      todayAttendance.location_verification_status === 'flagged' ? 'Flagged' :
                        'Pending'}
                </span>
              </div>

              {todayAttendance.distance_from_shop && (
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">Distance from Shop:</span>
                  <span className="font-medium">
                    {todayAttendance.distance_from_shop <= 1000 ?
                      `${Math.round(todayAttendance.distance_from_shop)}m` :
                      `${(todayAttendance.distance_from_shop / 1000).toFixed(1)}km`
                    }
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-xs sm:text-sm md:text-base">No attendance record for today</p>
        )}

        {/* Action Buttons */}
        <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
          {!todayAttendance?.check_in_time && (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn || locationLoading}
              className="w-full bg-blue-600 text-white px-4 py-2.5 sm:py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm sm:text-base font-medium shadow-sm active:scale-95 transition-transform"
            >
              {checkingIn ? 'Checking in...' : locationLoading ? 'Getting location...' : 'Check In'}
            </button>
          )}

          {todayAttendance?.check_in_time && (
            <button
              onClick={handleCheckOut}
              disabled={checkingOut || locationLoading || !!todayAttendance.check_out_time}
              className={`w-full text-white px-4 py-2.5 sm:py-3 rounded-lg flex items-center justify-center text-sm sm:text-base font-medium shadow-sm active:scale-95 transition-transform ${todayAttendance.check_out_time
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
                }`}
            >
              {todayAttendance.check_out_time
                ? 'Checked Out'
                : checkingOut
                  ? 'Checking out...'
                  : locationLoading
                    ? 'Getting location...'
                    : 'Check Out'}
            </button>
          )}

          {isMobileDevice && !manualOverride && (
            <button
              onClick={verifyLocation}
              disabled={locationLoading}
              className="w-full bg-gray-600 text-white px-4 py-2.5 sm:py-3 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm sm:text-base font-medium shadow-sm active:scale-95 transition-transform"
            >
              {locationLoading ? 'Getting location...' : 'Verify Location'}
            </button>
          )}
        </div>

        {locationError && (
          <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-800 text-xs sm:text-sm">{locationError}</p>
          </div>
        )}

        {currentLocation && (
          <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800 text-xs sm:text-sm">
              Current location: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              {currentLocation.accuracy && ` (±${Math.round(currentLocation.accuracy)}m accuracy)`}
            </p>
            {currentLocation.accuracy > 100 && (
              <p className="text-yellow-700 text-xs mt-1">
                GPS accuracy is poor. Try moving to a location with clearer sky view for better accuracy.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
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
                      {record.gps_check_in_verified && <span className="text-green-600 ml-1">✓</span>}
                    </div>
                    <div>
                      <span className="text-gray-500">Out: </span>
                      <span className="font-medium">{formatTime(record.check_out_time)}</span>
                      {record.gps_check_out_verified && <span className="text-green-600 ml-1">✓</span>}
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
                        {record.gps_check_in_verified && (
                          <span className="ml-2 text-xs text-green-600">✓ GPS</span>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(record.check_out_time) || '-'}
                        {record.gps_check_out_verified && (
                          <span className="ml-2 text-xs text-green-600">✓ GPS</span>
                        )}
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