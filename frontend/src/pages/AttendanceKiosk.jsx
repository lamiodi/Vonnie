import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost, apiGet } from '../utils/api';

const AttendanceKiosk = () => {
  const [time, setTime] = useState(new Date());
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('info'); // 'info', 'success', 'error'
  const navigate = useNavigate();

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
        const localResponse = await fetch('http://127.0.0.1:8080/api/capture');
        if (!localResponse.ok) throw new Error('Bridge error');
        captureData = await localResponse.json();
        
        if (captureData.error) throw new Error(captureData.error);
      } catch (err) {
        throw new Error(err.message === 'Failed to fetch' ? 'Scanner not detected. Ensure the ZKTeco bridge is running on this PC.' : err.message);
      }

      // 3. Ask local bridge to match
      setMessage('Identifying...');
      let identifyData;
      try {
        const matchResp = await fetch('http://127.0.0.1:8080/api/identify', {
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

      // 4. Send the matched data to the backend to toggle attendance
      const response = await apiPost('/attendance/kiosk-scan', {
        worker_id: identifyData.worker_id 
      });

      const responseData = response.data || response;
      
      setMessageType('success');
      setMessage(`Success! ${responseData.worker_name} has been ${responseData.action === 'check_in' ? 'Checked In' : 'Checked Out'}.`);
      
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
        <div className="bg-gray-900 py-10 text-center border-b border-gray-700">
          <h1 className="text-gray-400 text-xl font-medium tracking-widest uppercase mb-2">Vonne X2X Attendance</h1>
          <div className="text-6xl sm:text-7xl font-bold text-white tracking-tight">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-gray-400 mt-3 text-lg">
            {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {/* Scan Area */}
        <div className="p-10 flex flex-col items-center justify-center min-h-[320px]">
          
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
            <button
              onClick={handleScan}
              disabled={scanning}
              className="group flex flex-col items-center justify-center gap-6 focus:outline-none"
            >
              <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center group-hover:bg-teal-900/50 group-hover:shadow-[0_0_40px_rgba(20,184,166,0.3)] transition-all duration-300 border-4 border-gray-600 group-hover:border-teal-500">
                <svg className="w-16 h-16 text-gray-400 group-hover:text-teal-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white group-hover:text-teal-400 transition-colors">Tap to Scan</h2>
                <p className="text-gray-400 mt-2">Place your finger on the scanner</p>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceKiosk;
