import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost, apiGet, API_BASE_URL } from '../utils/api';

// Configurable constants - can be moved to environment variables or backend config
const CHECKOUT_TIME_HOUR = 20; // 8 PM
const CHECKOUT_TIME_MINUTE = 30; // 30 minutes
const FINGERPRINT_BRIDGE_URL = import.meta.env.VITE_FINGERPRINT_BRIDGE_URL || 'http://127.0.0.1:8081';

const AttendanceKiosk = () => {
  const [time, setTime] = useState(new Date());
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('info'); // 'info', 'success', 'error'
  const [attendanceData, setAttendanceData] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const navigate = useNavigate();

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch attendance data
  const fetchAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await apiGet(`/attendance/today`);
      const data = response.data || response;
      setAttendanceData(data || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAttendanceData([]);
    } finally {
      setLoadingAttendance(false);
    }
  };

  // Initial load and auto-refresh
  useEffect(() => {
    fetchAttendance();
    const refreshInterval = setInterval(fetchAttendance, 30000); // Refresh every 30 seconds
    return () => clearInterval(refreshInterval);
  }, []);

  // Helper functions for display
  const formatTime = (timeString) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const isCheckoutAllowed = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 100 + currentMinute;
    const checkoutTime = CHECKOUT_TIME_HOUR * 100 + CHECKOUT_TIME_MINUTE;
    
    return currentTime >= checkoutTime;
  };

  const getCheckoutMessage = () => {
    if (isCheckoutAllowed()) {
      return {
        allowed: true,
        message: 'You may now check out'
      };
    }
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Calculate remaining minutes until checkout time
    let remainingMinutes = (CHECKOUT_TIME_HOUR - currentHour) * 60 + (CHECKOUT_TIME_MINUTE - currentMinute);
    if (remainingMinutes < 0) remainingMinutes = 0;
    
    const checkoutTimeStr = `${CHECKOUT_TIME_HOUR}:${CHECKOUT_TIME_MINUTE.toString().padStart(2, '0')} ${CHECKOUT_TIME_HOUR >= 12 ? 'PM' : 'AM'}`;
    
    return {
      allowed: false,
      message: `Check-out opens at ${checkoutTimeStr} (${remainingMinutes} minutes remaining)`
    };
  };

  const getStatusBadge = (status, hasCheckedOut) => {
    if (hasCheckedOut) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-900/50 text-green-400 border border-green-600/50">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          Completed
        </span>
      );
    }
    
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-900/50 text-blue-400 border border-blue-600/50">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            Present
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-900/50 text-yellow-400 border border-yellow-600/50">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Late Arrival
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-gray-400 border border-gray-600">
            {status}
          </span>
        );
    }
  };

  const handleScan = async () => {
    try {
      setScanning(true);
      setMessageType('info');

      // 1. Fetch templates from Render backend
      setMessage('Loading database...');
      let templates = [];
      try {
        const tResp = await apiGet('/attendance/templates');
        templates = tResp.data || tResp;
      } catch (err) {
        throw new Error('Failed to load fingerprint database.');
      }

      // 2. Call the local ZKTeco bridge on the shop PC
      setMessage('Waiting for fingerprint...');
      let captureData;
      try {
        const localResponse = await fetch(`${FINGERPRINT_BRIDGE_URL}/api/capture`);
        if (!localResponse.ok) throw new Error('Bridge error');
        captureData = await localResponse.json();
        
        if (captureData.error) throw new Error(captureData.error);
      } catch (err) {
        throw new Error(err.message === 'Failed to fetch' ? 'Scanner not detected. Ensure the ZKTeco bridge is running.' : err.message);
      }

      // 3. Ask local bridge to match
      setMessage('Identifying...');
      let identifyData;
      try {
        const matchResp = await fetch(`${FINGERPRINT_BRIDGE_URL}/api/identify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verTemplate: captureData.template,
            regTemplates: templates
          })
        });
        identifyData = await matchResp.json();
      } catch (err) {
        throw new Error('Failed to identify fingerprint locally.');
      }

      if (!identifyData.match || !identifyData.worker_id) {
        throw new Error('Fingerprint not recognized. Score: ' + (identifyData.score || 0));
      }

      // 4. Check if checkout is allowed
      const todayRecord = attendanceData.find(r => r.worker_id === identifyData.worker_id);
      const isCurrentlyCheckedIn = todayRecord && !todayRecord.check_out_time;
      
      if (isCurrentlyCheckedIn && !isCheckoutAllowed()) {
        throw new Error(getCheckoutMessage().message);
      }

      // 5. Send the matched data to the backend to toggle attendance
      // Use direct fetch to avoid auth headers for public endpoint
      const response = await fetch(`${API_BASE_URL}/attendance/public-kiosk-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          worker_id: identifyData.worker_id 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      
      setMessageType('success');
      let successMessage = `Success! ${responseData.worker_name} has been ${responseData.action === 'check_in' ? 'Checked In' : 'Checked Out'}.`;
      
      if (responseData.action === 'check_out' && !isCheckoutAllowed()) {
        successMessage += ' (Early checkout recorded)';
      }
      
      setMessage(successMessage);
      
      // Clear success message after 4 seconds
      setTimeout(() => setMessage(null), 4000);

    } catch (error) {
      setMessageType('error');
      setMessage(error.response?.data?.error || error.message || 'Scan failed. Please try again.');
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      {/* Exit Button */}
      <button 
        onClick={() => navigate('/attendance')}
        className="absolute top-6 left-6 text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Exit Kiosk
      </button>

      <div className="max-w-2xl w-full bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-700">
        
        {/* Header / Clock */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 py-10 text-center border-b border-gray-700">
          <h1 className="text-gray-300 text-xl font-medium tracking-widest uppercase mb-2">Vonne X2X Attendance</h1>
          <div className="text-6xl sm:text-7xl font-bold text-white tracking-tight mb-2">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-gray-400 mt-3 text-lg">
            {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-green-400 text-sm font-medium">System Active</span>
          </div>
        </div>

        {/* Scan Area */}
        <div 
          onClick={!scanning ? handleScan : undefined}
          className={`p-10 flex flex-col items-center justify-center min-h-[320px] transition-all duration-200 ${
            !scanning ? 'cursor-pointer hover:bg-gray-700/30' : ''
          }`}
        >
          
          {message ? (
            <div className={`text-center animate-fade-in ${
              messageType === 'success' ? 'text-green-400' : 
              messageType === 'error' ? 'text-red-400' : 'text-blue-400'
            }`}>
              {messageType === 'success' && (
                <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {messageType === 'error' && (
                <svg className="w-20 h-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {messageType === 'info' && (
                <svg className="w-20 h-20 mx-auto mb-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
              )}
              <h2 className="text-2xl font-semibold">{message}</h2>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-teal-600 to-teal-700 flex items-center justify-center shadow-lg border-4 border-teal-500 animate-pulse-slow">
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Tap to Scan</h2>
                <p className="text-gray-400 mt-2">Place your finger on the scanner</p>
                <p className="text-sm text-gray-500 mt-2">Fingerprint recognition active</p>
              </div>
            </div>
          )}
        </div>

        {/* Attendance Display */}
        <div className="border-t border-gray-700 bg-gray-850/50">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Today's Attendance
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  {attendanceData.length} {attendanceData.length === 1 ? 'person' : 'people'}
                </span>
                {!isCheckoutAllowed() && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-400 border border-yellow-600/50">
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Checkout at 8:30 PM
                  </span>
                )}
              </div>
            </div>

            {loadingAttendance ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400"></div>
                <span className="ml-3 text-gray-400">Loading attendance...</span>
              </div>
            ) : attendanceData.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p>No attendance records yet</p>
                <p className="text-sm mt-1">First check-in will appear here</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {attendanceData.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-teal-900/30 rounded-full flex items-center justify-center border border-teal-600/30">
                        <span className="text-teal-400 font-medium text-sm">
                          {record.worker_name ? record.worker_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{record.worker_name || 'Unknown Worker'}</h4>
                        <p className="text-sm text-gray-400">
                          Checked in at {formatTime(record.check_in_time)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(record.status, !!record.check_out_time)}
                      {record.check_out_time && (
                        <span className="text-sm text-gray-400">
                          Out at {formatTime(record.check_out_time)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceKiosk;
