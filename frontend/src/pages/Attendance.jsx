import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, API_ENDPOINTS } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { handleError, handleSuccess } from '../utils/errorHandler';

const Attendance = () => {
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
    // Check if it's a mobile device
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

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      setLocationLoading(true);
      setLocationError('');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setCurrentLocation(location);
          setLocationLoading(false);
          resolve(location);
        },
        (error) => {
          setLocationLoading(false);
          let errorMessage = 'Failed to get location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
          }
          setLocationError(errorMessage);
          reject(new Error(errorMessage));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  };

  const handleCheckIn = async () => {
    try {
      setCheckingIn(true);
      setLocationError('');
      
      let locationData = {};
      
      // Try to get GPS location
      try {
        const location = await getCurrentLocation();
        locationData = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy
        };
      } catch (locationError) {
        // Allow check-in without GPS if user denies permission or on desktop
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

      // Show appropriate notification based on verification status
      const responseData = response.data || response;
      if (responseData.location_verification_status === 'rejected') {
        setLocationError('Unable to verify attendance. You appear to be too far from shop.');
      } else if (responseData.location_verification_status === 'verified') {
        // Success - clear any previous errors
        setLocationError('');
      }

      handleSuccess('Check-in successful');
      fetchAttendanceRecords(); // Refresh the list
      
      // Reset location after successful check-in
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
      
      // Try to get GPS location
      try {
        const location = await getCurrentLocation();
        locationData = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy
        };
      } catch (locationError) {
        // Allow check-out without GPS if user denies permission or on desktop
        console.warn('GPS location not available:', locationError.message);
        if (!isMobileDevice || manualOverride) {
          setLocationError('Check-out recorded without GPS verification (Desktop mode)');
        } else {
          setLocationError('Check-out without GPS - location verification disabled');
        }
      }

      const response = await apiPost(API_ENDPOINTS.ATTENDANCE_CHECKOUT, {
        worker_id: user.id,
        ...locationData
      });

      handleSuccess('Check-out successful');
      fetchAttendanceRecords(); // Refresh the list
      
      // Reset location after successful check-out
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
    return attendanceRecords.find(record => record.date === today);
  };

  const todayAttendance = getTodayAttendance();

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Attendance Management</h1>
        <p className="text-gray-600">Track worker attendance with GPS verification</p>
      </div>

      {/* Device Detection Notice */}
      {!isMobileDevice && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-blue-800">Desktop Device Detected</h3>
              <p className="text-sm text-blue-700 mt-1">
                GPS accuracy may be limited on desktop devices. Consider using a mobile device for better location accuracy, 
                or enable manual override to proceed without GPS verification.
              </p>
              <button
                onClick={() => setManualOverride(!manualOverride)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
              >
                {manualOverride ? 'Disable Manual Override' : 'Enable Manual Override'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Today's Attendance Status */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Today's Attendance</h2>
        
        {todayAttendance ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                todayAttendance.status === 'present' ? 'bg-green-100 text-green-800' :
                todayAttendance.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                todayAttendance.status === 'flagged' ? 'bg-orange-100 text-orange-800' :
                'bg-red-100 text-red-800'
              }`}>
                {todayAttendance.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-600">Check-in:</span>
                <p className="font-medium">{formatTime(todayAttendance.check_in_time)}</p>
                {todayAttendance.gps_check_in_verified && (
                  <span className="text-xs text-green-600 flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                    GPS Verified
                  </span>
                )}
              </div>
              
              {todayAttendance.check_out_time && (
                <div>
                  <span className="text-gray-600">Check-out:</span>
                  <p className="font-medium">{formatTime(todayAttendance.check_out_time)}</p>
                  {todayAttendance.gps_check_out_verified && (
                    <span className="text-xs text-green-600 flex items-center">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                      GPS Verified
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Location Status:</span>
              <span className={`px-2 py-1 rounded text-xs ${
                todayAttendance.location_verification_status === 'verified' ? 'bg-green-100 text-green-800' :
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
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Distance from Shop:</span>
                <span className="font-medium text-sm">
                  {todayAttendance.distance_from_shop <= 1000 ? 
                    `${Math.round(todayAttendance.distance_from_shop)}m` :
                    `${(todayAttendance.distance_from_shop / 1000).toFixed(1)}km`
                  }
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500">No attendance record for today</p>
        )}

        {/* Action Buttons */}
        <div className="mt-6 space-y-4">
          {!todayAttendance?.check_in_time && (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn || locationLoading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {checkingIn ? 'Checking in...' : locationLoading ? 'Getting location...' : 'Check In'}
            </button>
          )}
          
          {todayAttendance?.check_in_time && !todayAttendance?.check_out_time && (
            <button
              onClick={handleCheckOut}
              disabled={checkingOut || locationLoading}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {checkingOut ? 'Checking out...' : locationLoading ? 'Getting location...' : 'Check Out'}
            </button>
          )}
          
          {isMobileDevice && !manualOverride && (
            <button
              onClick={verifyLocation}
              disabled={locationLoading}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {locationLoading ? 'Getting location...' : 'Verify Location'}
            </button>
          )}
        </div>

        {locationError && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-800 text-sm">{locationError}</p>
          </div>
        )}

        {currentLocation && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800 text-sm">
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
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchAttendanceRecords}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Records */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Attendance History</h2>
        </div>
        
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading attendance records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Worker</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(record.date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(record.check_in_time)}
                      {record.gps_check_in_verified && (
                        <span className="ml-2 text-xs text-green-600">✓ GPS</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(record.check_out_time) || '-'}
                      {record.gps_check_out_verified && (
                        <span className="ml-2 text-xs text-green-600">✓ GPS</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        record.status === 'present' ? 'bg-green-100 text-green-800' :
                        record.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                        record.status === 'flagged' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.location_verification_status === 'verified' ? (
                        <span className="text-green-600">✓ Verified</span>
                      ) : record.location_verification_status === 'rejected' ? (
                        <span className="text-red-600">✗ Rejected</span>
                      ) : record.location_verification_status === 'flagged' ? (
                        <span className="text-yellow-600">⚠ Flagged</span>
                      ) : (
                        <span className="text-gray-400">No Data</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {attendanceRecords.length === 0 && (
              <div className="p-6 text-center text-gray-500">No attendance records found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Attendance;