import React, { useState, useEffect } from 'react';
import { apiGet, apiPost, API_ENDPOINTS } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { handleError, handleSuccess } from '../utils/errorHandler';

const Attendance = () => {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  // If user is admin, they don't need to mark attendance
  if (isAdmin) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Attendance Management</h1>
          <p className="text-gray-600">Track worker attendance records</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="bg-purple-100 p-3 rounded-full">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Admin Exempt</h3>
              <p className="text-gray-600 text-sm sm:text-base">As the salon owner/admin, you are exempt from attendance tracking requirements.</p>
            </div>
          </div>
        </div>

        {/* Admin can still see the records table below */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-4 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Worker Attendance Records</h3>
          </div>
          {/* Reuse the existing table component logic or simpler view for admin */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Worker</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Check In</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Check Out</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:hidden">Times</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                      No attendance records found
                    </td>
                  </tr>
                ) : (
                  attendanceRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(record.date)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.worker_name || 'Unknown'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                        {formatTime(record.check_in_time)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                        {formatTime(record.check_out_time)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 sm:hidden">
                        <div>In: {formatTime(record.check_in_time)}</div>
                        <div>Out: {formatTime(record.check_out_time)}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          record.status === 'present' ? 'bg-green-100 text-green-800' : 
                          record.status === 'late' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

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
        // Only accept high accuracy results (< 50m) if possible, but relax for retries
        // If accuracy is poor (>100m) and we have retries left, try again
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
        setLocationError('Unable to verify attendance. You appear to be outside the shop. Please ensure you are inside the shop to mark attendance.');
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
    return attendanceRecords.find(record => {
      // Handle potential full ISO string from backend
      const recordDate = new Date(record.date).toISOString().split('T')[0];
      return recordDate === today;
    });
  };

  const todayAttendance = getTodayAttendance();

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Attendance</h1>
        
        {/* Guidelines Section */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded-r-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Attendance Guidelines</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Check-In:</strong> You must be within 500 meters of the shop to check in. Please enable GPS location on your device.</li>
                  <li><strong>One Check-In Per Day:</strong> You can only check in once per day. If you check out, you cannot check in again until tomorrow.</li>
                  <li><strong>Check-Out:</strong> Don't forget to check out when you leave! The "Check Out" button will appear only after you have checked in.</li>
                  <li><strong>Troubleshooting:</strong> If the "Check Out" button is missing, refresh the page. If GPS fails, try moving near a window or going outside for a moment.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Device Detection Notice - Hidden as requested to simplify user experience */}
      {!isMobileDevice && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 sm:p-4 mb-6">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Today's Attendance</h2>
        
        {todayAttendance ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-gray-600 font-medium">Status:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium w-fit ${
                todayAttendance.status === 'present' ? 'bg-green-100 text-green-800' :
                todayAttendance.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                todayAttendance.status === 'flagged' ? 'bg-orange-100 text-orange-800' :
                'bg-red-100 text-red-800'
              }`}>
                {todayAttendance.status}
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-md">
                <span className="text-gray-600 text-sm block mb-1">Check-in:</span>
                <p className="font-semibold text-gray-900">{formatTime(todayAttendance.check_in_time)}</p>
                {todayAttendance.gps_check_in_verified && (
                  <span className="text-xs text-green-600 flex items-center mt-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                    Location Verified
                  </span>
                )}
              </div>
              
              {todayAttendance.check_out_time && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <span className="text-gray-600 text-sm block mb-1">Check-out:</span>
                  <p className="font-semibold text-gray-900">{formatTime(todayAttendance.check_out_time)}</p>
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
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Location Status:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
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
                <div className="flex items-center justify-between text-sm">
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
          <p className="text-gray-500 text-sm sm:text-base">No attendance record for today</p>
        )}

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          {!todayAttendance?.check_in_time && (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn || locationLoading}
              className="w-full bg-blue-600 text-white px-4 py-3 sm:py-2 rounded-lg sm:rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-sm active:scale-95 transition-transform"
            >
              {checkingIn ? 'Checking in...' : locationLoading ? 'Getting location...' : 'Check In'}
            </button>
          )}
          
          {todayAttendance?.check_in_time && (
            <button
              onClick={handleCheckOut}
              disabled={checkingOut || locationLoading || !!todayAttendance.check_out_time}
              className={`w-full text-white px-4 py-3 sm:py-2 rounded-lg sm:rounded-md flex items-center justify-center font-medium shadow-sm active:scale-95 transition-transform ${
                todayAttendance.check_out_time 
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
              className="w-full bg-gray-600 text-white px-4 py-3 sm:py-2 rounded-lg sm:rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium shadow-sm active:scale-95 transition-transform"
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
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Filters</h2>
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
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm active:scale-95 transition-transform"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Records */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Attendance History</h2>
        </div>
        
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading attendance records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Worker</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Check In</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Check Out</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:hidden">Times</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Location</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(record.date)}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.name}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden sm:table-cell">
                      {formatTime(record.check_in_time)}
                      {record.gps_check_in_verified && (
                        <span className="ml-2 text-xs text-green-600">✓ GPS</span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden sm:table-cell">
                      {formatTime(record.check_out_time) || '-'}
                      {record.gps_check_out_verified && (
                        <span className="ml-2 text-xs text-green-600">✓ GPS</span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 sm:hidden">
                      <div className="flex flex-col text-xs space-y-1">
                        <span className="flex items-center">
                          <span className="w-6 text-gray-500">In:</span> 
                          {formatTime(record.check_in_time)}
                          {record.gps_check_in_verified && <span className="ml-1 text-green-600">✓</span>}
                        </span>
                        <span className="flex items-center">
                          <span className="w-6 text-gray-500">Out:</span> 
                          {formatTime(record.check_out_time) || '-'}
                          {record.gps_check_out_verified && <span className="ml-1 text-green-600">✓</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        record.status === 'present' ? 'bg-green-100 text-green-800' :
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